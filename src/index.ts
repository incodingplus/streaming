import main from './main.js';
import express from 'express';
import test from './test.js';
import fs from 'fs';
import cors from 'cors';
const app = express();

app.use(cors());

app.use(express.urlencoded({
    limit:'500mb',
    extended:true
}));

app.use(express.raw({
    limit:'2gb'
}));
app.use(express.json());
app.use('/.well-known/acme-challenge/:id', async (req, res) => {
    const txt = await fs.promises.readFile('./logs/let.txt', {encoding:'utf-8'});
    res.end(`${req.params.id}.${txt}`);
});

app.use('/video/test', test);
app.use('/video', main);

app.listen(5000);