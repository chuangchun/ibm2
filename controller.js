'use strict'
const db = require('./data');

function validate(filter)
{
    if ( filter.operator === undefined || 
         filter.field === undefined ||
         filter.value === undefined  )
    {
        return false;
    }

    if ( filter.start === undefined )
    {
        filter.start = 0;
        filter.end = db.getPageCount();
    }
    return true;
}

module.exports = {
getAll(req, res)
{
    res.send(db.getAll());
    res.end();
},

getAllPaginated(req, res)
{
    const body = req.body;
    if ( body.requestType !== 'getAllPaginated') 
    {
        res.send({});
        return;
    }

    if ( body.start === undefined ) 
    {
        body.start = 0;
        body.end = db.getPageCount();
    }
    res.send(db.getAllPaginated(body.start, body.end));
    res.end();
},

filters(req, res) 
{
    const body = req.body;
    if ( body.filters === undefined ) 
    {
        res.send({});
        res.end();
        return;
    }

    for (let i = 0; i < body.filters.length; ++i )
    {
        if ( !validate(body.filters[i])) 
        {
            res.send({});
            res.end();
            return;
        }
    }
    res.send(db.filters(body.filters, body.start, body.end));
},

filter(req, res)
{
    const body = req.body;
    const filter = { field : body.field, operator : body.operator, value : body.value };
    if ( body.requestType !== 'filter' || !validate(filter) ) 
    {
        res.send({});
        res.end();
        return;
    }

    if ( body.sortOrder === undefined )
        body.sortOrder = 'asc';

    res.send(db.filter(body.field, body.operator, body.value, body.start, body.end, body.sortOrder));
}

}