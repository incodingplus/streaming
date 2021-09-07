import { EventEmitter } from 'events'

type HandlerMap = {
    time: Date
    timeoutHandler: ReturnType<typeof setTimeout>
}

export class AutoRemoveSet<T> {
    set: Set<T>
    handlerMap: Map<T, HandlerMap>

    constructor(){
        this.set = new Set<T>()
        this.handlerMap = new Map<T, HandlerMap>()
    }

    private deleteHandler(key: T) {
        if(this.handlerMap.has(key)) {
            const { timeoutHandler } = this.handlerMap.get(key)
            clearTimeout(timeoutHandler)
        }
    }

    private newHandler(key: T, timeout: number): HandlerMap {
        if(timeout < 0) {
            return {
                time: new Date(), timeoutHandler: null
            }
        }
        return {
            time: new Date(),
            timeoutHandler: setTimeout(() => {
                this.handlerMap.delete(key)
                this.set.delete(key)
            }, timeout)
        }
    }

    has(key: T) {
        return this.set.has(key)
    }

    add(key: T, timeout: number = 5 * 60 * 1000) {

        if(this.set.has(key)) {
            this.deleteHandler(key)
        }

        const h = this.newHandler(key, timeout)
        this.handlerMap.set(key, h)
        return this.set.add(key)
    }

    delete(key: T) {
        if(this.set.has(key) == false) return

        this.deleteHandler(key)
        this.handlerMap.delete(key)
        return this.set.delete(key)
    }
}


export class AutoRemoveMap<K, V> {
    map: Map<K, V>
    handlerMap: Map<K, HandlerMap>
    emitter: EventEmitter

    constructor(){
        this.map = new Map<K, V>()
        this.handlerMap = new Map<K, HandlerMap>()
        this.emitter = new EventEmitter()
    }

    private deleteHandler(key: K) {
        if(this.handlerMap.has(key)) {
            const { timeoutHandler } = this.handlerMap.get(key)
            clearTimeout(timeoutHandler)
            this.handlerMap.delete(key)
        }
    }

    private newHandler(key: K, timeout: number): HandlerMap {
        if(timeout < 0) {
            return {
                time: new Date(), timeoutHandler: null
            }
        }
        return {
            time: new Date(),
            timeoutHandler: setTimeout(this.delete.bind(this, key), timeout)
        }
    }

    on(eventName: 'delete'|'set'|'resetTimeout', listener: (data: V) => void) {
        this.emitter.on(eventName, listener)
    }
    
    off(eventName: 'delete'|'set'|'resetTimeout', listener: (data: V) => void) { 
        this.emitter.off(eventName, listener)
    }

    has(key: K) {
        return this.map.has(key)
    }

    get(key: K){
        return this.map.get(key)
    }

    resetTimeout(key: K, timeout: number) {
        this.deleteHandler(key)

        const h = this.newHandler(key, timeout)
        this.handlerMap.set(key, h)

        this.emitter.emit('resetTimeout', this.map.get(key))
    }

    set(key: K, data: V, timeout: number = 5 * 60 * 1000) {

        if(this.map.has(key)) {
            this.deleteHandler(key)
        }

        const h = this.newHandler(key, timeout)
        this.handlerMap.set(key, h)
        this.map.set(key, data)
        this.emitter.emit('set', data)
    }

    delete(key: K) {
        if(this.map.has(key) == false) return

        this.deleteHandler(key)
        
        const v = this.map.get(key)
        this.map.delete(key)
        this.emitter.emit('delete', v)
    }
}