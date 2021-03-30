export interface HowLong{
    user_id:string;
    set:Set<string>;
    length:number;
    time:NodeJS.Timeout|null;
    material_id:string;
    dev:string;
};

export interface Finish{
    user_id:string;
    material_id:string;
    status:string;
    length:number;
};