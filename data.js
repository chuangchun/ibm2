'use strict'
const reader = require('line-reader');
const isNumber = require('is-number');
const MaxValueCachePerFilter = 100;
const original = [];
const GreaterThan = 'GREATER-THAN';
const StartsWith  = 'STARTSWITH';
const Contains    = 'CONTAINS';

const supportedNumberOperator = new Set().add(GreaterThan);
const supportedStringOperator = new Set().add(StartsWith).add(Contains).add(GreaterThan);
const filtered = {};
const cache = {};       // cache looks like this { 'field-operator' : [ [[ v1, accessts ], [ v2, accessTs ], ..], { v1 : [ sortOrder, [items, ...]] } ] }

const readPromise = (filename) => {
    return new Promise((resolve, reject) => {
        reader.eachLine(filename, (line, last) => {
            line = line.replace('[', '').replace('},', '}').replace(']', '');  // input file not a legal json, clean it up.
            const json = JSON.parse(line);
            original.push(json);
            if (last) resolve();
        });
    })
}

const pageCount = 10;

function compare(x, y)
{
    if (x < y) return -1;
    else if ( x === y ) return 0;
    else return 1;
}

function filterByString(data, filter)
{
    if ( typeof filter.value !== 'string' ) filter.value = filter.value.toString();
    let out = [];
    switch ( filter.operator ) {
        case GreaterThan:
            out = data.filter(x => x[filter.field].toLowerCase() > filter.value);
            break;
        case StartsWith:
            out = data.filter(x => x[filter.field].toLowerCase().startsWith(filter.value));
            break;
        case Contains:
            out = original.filter(x => x[filter.field].toLowerCase().indexOf(filter.value) != -1);
            break;
        default:
    }
    return out;
}

function filterByNumber(data, filter)
{
    if ( filter.operator !== 'GREATER-THAN') return {};
    return data.filter(x => x[filter.field] > filter.value);
}

function sort(data, field, sortOrder)
{
    if ( sortOrder === 'asc' ) 
        data.sort((x, y) => compare(x[field], y[field]));
    else                       
        data.sort((x, y) => compare(y[field], x[field]));
}

exports = module.exports;

exports.setPageCount = (count) => { pageCount = count; };
exports.getPageCount = () => { return pageCount; };
exports.getAllPaginated = (start, end) => {

    console.log("Calling getAllPaginated ...");
    const val = {
        operator : 'getAllPaginated',
        total_count : original.length,
        start : start,
        end : end,
        data : original.slice(start, end)
    };
    return val;
};

exports.getAll = () => {
    console.log("entering getAll");
    const val = {
        operator : 'getAll',
        data : original
    }
    return val;
};

function validate(filter)
{
    if ( original[0][filter.field] === undefined ) 
    {
        console.log("filter: illegal field:", field);
        return false;
    }

    if ( typeof original[0][filter.field] === 'number' )
    {
        if (!supportedNumberOperator.has(filter.operator)) 
        {
            console.log("filter: supported number operators:", supportedNumberOperator);
            console.log("filter: Unsupported number operator:", filter.operator);
            return false;
        }

        if (typeof filter.value !== 'number') 
        {
            filter.value = filter.value.toString();
            if ( !isNumber(parseInt(filter.value)) ) 
            {
                console.log("filter: Illegal number format:", filter.value);
                return false;
            }
            else filter.value = parseInt(filter.value);
        }
        filter.isString = false
    }

    if ( typeof original[0][filter.field] === 'string' )
    {
        if (!supportedStringOperator.has(filter.operator)) 
        {
            console.log("filter: unsupported string operator:", filter.operator);
            return false;
        }
        if ( typeof filter.value !== 'string' ) filter.value = filter.value.toString();
        filter.value = filter.value.toLowerCase();      // assume we are filtering based on lowercase.
        filter.isString = true;
    }
    return true;
}

function doFilters(filters, key, value, sortOrder)
{
    let vCache = cache[key];
    if ( vCache === undefined )
    {
        vCache = [ [], {} ];
        cache[key] = vCache;
    }
    else
    {
        // last in last out, maintain only MaxValueCachePerFilter
        // This can be improved, but for the time being, use linear search
        let i;
        let found = false;
        for (i = 0; i < vCache[0]; ++i)
        {
            if ( vCache[0][0] === value )
            {
                vCache[0][1] = new Data.getTime();
                found = true;
                break;
            }
        }
        if ( !found ) vCache[0].shift([ value, new Date().getTime()]);
        vCache[0].sort((x, y) => y[1] - x[1]);
    }

    // check if we are over the caceh limit
    if ( vCache[0].length >= MaxValueCachePerFilter )
    {
        const v = vCache[0].pop();
        delete vCache[1][v];
    }

    const items = vCache[1];
    console.log("filter: sortOrder:", sortOrder);
    if ( items[value] === undefined || (sortOrder !== undefined && items[value][0] !== sortOrder) )
    {
        if ( items[value] !== undefined )
        {
            console.log("filter: existing sort order:", items[value][0]);
        }

        console.log("filter: rebuild cache for:", key, value);
        let data = original;
        for (let i = 0; i < filters.length; ++i)
        {
            data = filters[i].isString ? filterByString(data, filters[i]) : filterByNumber(data, filters[i]);
        }

        if ( sortOrder !== undefined )
        {
            sort(data, filters[0].field, sortOrder);
            items[value] = [ sortOrder, data ];
        }
        else
        {
            items[value] = [ 'asc', data ];
        }
    }
    return items;
}

exports.filters = (filters, start, end) =>
{
    console.log("Calling filters .. ");
    if ( original.length == 0 ) return {}

    let valid = true;
    for (let i = 0; i < filters.length; ++i )
    {
        valid &= validate(filters[i]);
    }
    if (!valid) return {};

    let key = '';
    let value = '';
    for ( let i = 0; i < filters.length; ++i )
    {
        if ( key.length == 0 )
        {
            key += filters[i].field + '-' + filters[i].operator;
            value = filters[i].value;
        }
        else
        {
            key += '-' + filters[i].field + '-' + filters[i].operator;
            value += '/' + filters[i].value;
        }
    }

    const items = doFilters(filters, key, value, undefined);
    return {
        operator : 'filters',
        filters : filters,
        total_count : items[value][1].length,
        start : start,
        end : end,
        data : items[value][1].slice(start, end)
    }
}

exports.filter = (field, operator, value, start, end, sortOrder) => {

    console.log("Calling filter .. ");
    if ( original.length == 0 ) return {}

    const filter = { field : field, operator : operator, value : value };
    if ( !validate(filter) ) return {};

    const key = field + '-' + operator;
    console.log("filter: search with key:", key);

    const filters = [ filter ];
    const items = doFilters(filters, key, value, sortOrder);
    return {
        operator : 'filter',
        field : field,
        value : value,
        total_count : items[value][1].length,
        start : start,
        end : end,
        data : items[value][1].slice(start, end)
    }
}

// initialize
readPromise('sample.json').then(() =>
    console.log('number of records read: ', original.length)
)
