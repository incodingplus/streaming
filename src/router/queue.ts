import { EventEmitter } from 'events'

export class Queue<T> {
    arr: T[]
    emitter: EventEmitter

    constructor(){
        this.arr = []
        this.emitter = new EventEmitter()
    }

    get size(){
        return this.arr.length
    }

    on(eventName: 'push', callback: () => void){
        this.emitter.on(eventName, callback)
    }
    
    off(eventName: 'push', callback: () => void){
        this.emitter.off(eventName, callback)
    }

    push(d: T) {
        this.arr.push(d)
        this.emitter.emit('push')
    }

    top(){
        return this.arr[0]
    }

    pop(){
        return this.arr.shift()
    }
}