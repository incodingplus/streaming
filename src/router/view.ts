import fs from 'fs'
import { EventEmitter } from 'events'

enum EVENTS {
    VIEW_HTML_LOADED = 'VIEW_HTML_LOADED'
}

const emitter = new EventEmitter()
let viewHTML: string = '';

(async function() {
    viewHTML = await fs.promises.readFile('./view/video.html', { encoding:'utf-8' });
    emitter.emit(EVENTS.VIEW_HTML_LOADED, viewHTML)
})()

export const getViewHTML = () => {
    return new Promise<string>((resolve, reject) => {
        if(viewHTML != '') return resolve(viewHTML)
        emitter.once(EVENTS.VIEW_HTML_LOADED, () => resolve(viewHTML))
    })
}