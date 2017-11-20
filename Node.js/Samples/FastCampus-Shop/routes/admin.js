const express = require('express');
const router = express.Router();
const Products = require('../models/products');

router.get('/', (req, res) => {
    res.send('It is a admin app!');
});

router.get('/products', (req, res) => {
    Products.find({}, (err, products) => {
        res.render('admin/products', {
            products : products
        });
    });
});

router.get('/products/write', (req, res) => {
    res.render('admin/form');
});

router.post('/products/write', (req, res) => {
    const product = new Products({
        name : req.body.name,
        price : req.body.price,
        description : req.body.desription
    })

    product.save((err) => {
        res.redirect('/admin/products');     
    })
});

module.exports = router;