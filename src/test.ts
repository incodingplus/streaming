import express from 'express';
import path from 'path'
import { tokens } from './router/token';
import { logger } from './utils/logger'

const router = express.Router();

router.post('/howlong', (req, res) => {
    logger.debug(req.body);
    res.end('잘옴');
});

//token 체크
router.use('/', (req, res, next) => {
    if(req.query.token){
        next();
    } else {
        res.redirect('/video/error');
    }
})

router.get('/', (req, res) => {
    if(tokens.has(req.query.token as string)){
        res.sendFile('index.html', {
            root: path.resolve(__dirname, '../view')
        });
    } else {
        res.status(404);
        res.redirect('/video/error');
    }
});

router.get('/check', (req, res) => {   //서버 코드
    const token = req.query.token;
    if(token === 'good'){
        res.end('good')
    } else {
        res.end('bad');
    }
});

export default router;