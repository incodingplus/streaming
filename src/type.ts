export interface HowLong{
    user_id:string;
    set:Set<string>;
    length:number;
    size:number;
    time:NodeJS.Timeout|null;
    material_id:string;
    dev:string;
};

export interface Finish{
    user_id:string;
    material_id:string;
    size:number;
    length:number;
};