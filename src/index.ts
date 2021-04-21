import main from './main.js';
import express from 'express';
import test from './test.js';
import fs from 'fs';
const app = express();
app.use(express.urlencoded({
    extended:true
}));
app.use(express.json());
app.use('/.well-known/acme-challenge/:id', async (req, res) => {
    const txt = await fs.promises.readFile('./logs/let.txt', {encoding:'utf-8'});
    res.end(`${req.params.id}.${txt}`);
});

app.use('/video/test', test);
app.use('/video', main);

app.listen(5000);