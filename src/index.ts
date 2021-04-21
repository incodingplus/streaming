import main from './main.js';
import express from 'express';
import test from './test.js';
import fs from 'fs';
import process from 'process';
import https from 'https';
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

if(process.argv[2] === 'https'){
    console.log('https 가동');
    const options = {
        key: fs.readFileSync(`/etc/letsencrypt/live/${process.argv[3]}/privkey.pem`),
        cert: fs.readFileSync(`/etc/letsencrypt/live/${process.argv[3]}/cert.pem`),
        ca: fs.readFileSync(`/etc/letsencrypt/live/${process.argv[3]}/chain.pem`)
    }
    https.createServer(options, app).listen(5000);
} else {
    app.listen(5000);
}