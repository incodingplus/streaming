export interface HowLong{
    token:string;
    set:Set<string>;
    length:number;
    size:number;
    time:NodeJS.Timeout|null;
    url:string;
};
