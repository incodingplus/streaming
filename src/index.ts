import path from 'path'
import { loadEnv } from './env'
loadEnv(path.resolve(__dirname, process.env.NODE_ENV === 'production' ? '../env.json' : '../env.dev.json'))

import express from 'express';
import 'express-async-errors'
import cors from 'cors';

import main from './router';
import api from './router/api';
import test from './test';
import { logger } from './utils/logger'

const app = express();

app.use(cors());

app.use(express.urlencoded({
    limit: '500mb',
    extended: true
}));

app.use(express.raw({
    limit: '8gb'
}));
app.use(express.json());

app.use('/video/test', test);
app.use('/video', main);
app.use('/api', api);

app.use((err, req, res, next) => {
    logger.error('Error captured')
    logger.error(err)

    req.status(500).send('Internal server error')
})

app.listen(5000, () => {
    logger.info('Server listen on 5000')
});

process.on('uncaughtException', (err) => {
    logger.error('uncaughtException 발생')
    logger.error(err)
})

process.on('unhandledRejection', (reason, promise) => {
    logger.error('unhandledRejection 발생')
    logger.error(reason)
})