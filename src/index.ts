import main from './main.js';
import express from 'express';
import test from './test.js';
const app = express();
app.use(express.urlencoded({
    extended:true
}));
app.use(express.json());
app.use('/.well-known/acme-challenge/:id', (req, res) => {
    console.log(req.params.id);
    res.end('good');
});

app.use('/video/test', test);
app.use('/video', main);

app.listen(5000);