import pino from 'pino'

export const logger = pino({
    prettyPrint: {
        colorize: false,
        translateTime: true
    },
    level: 'debug'
})
