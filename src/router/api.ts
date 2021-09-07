import express from 'express';
import { listSubDirectories } from './s3';
import { encodingList } from './encode'

const app = express.Router();

app.get('/status', async (req, res) => {

    const { token } = req.query
    if(token !== '7b3fcee5b1aa32ee5ca8144671816e2534cf2335b5efa3b83af5a902c992b6d9') {
        res.status(503).end('bad')
        return
    }

    const dirs = await listSubDirectories('videos/')
    const videoIds = dirs.map(el => el.match(/\/([^\/]+)\/$/)[1])

    const result = {
        처리중: encodingList(),
        목록: videoIds,
    };
    res.json(result);
});

export default app;