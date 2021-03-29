export interface HowLong{
    user_id:string;
    set:Set<string>;
    length:number;
    size:number;
    time:NodeJS.Timeout|null;
    material_id:string;
};
