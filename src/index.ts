import path from 'path'
import { loadEnv } from './env'
loadEnv(path.resolve(__dirname, process.env.NODE_ENV === 'production' ? '../env.json' : '../env.dev.json'))

import express from 'express';
import 'express-async-errors'
import cors from 'cors';

import main from './router';
import api from './router/api';
import test from './test.js';

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

app.use('/video/test', test);
app.use('/video', main);
app.use('/api', api);

app.use((err, req, res, next) => {
    console.error('Error captured')
    console.error(err)

    req.status(500).send('Internal server error')
})

app.listen(5000, () => {
    console.info('Server listen on 5000')
});