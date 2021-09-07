export interface HowLong{
    user_id:string;
    set:Set<string>;
    files: string[];
    length:number;
    material_id:string;
    dev:string;
    ms:number;
};

export interface Finish{
    user_id:string;
    material_id:string;
    status:string;
    length:number;
    ms:number;
};