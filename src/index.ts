import main from './main.js';
import express from 'express';
import test from './test.js';
const app = express();
app.use(express.urlencoded({
    extended:true
}));
app.use(express.json());
app.use('/video', main);
app.use('/video/test', test);


app.listen(5000);