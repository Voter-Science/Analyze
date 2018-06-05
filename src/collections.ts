// Simple collection interfaces 

export class TimeRange 
{       
    private _start : Date;
    private _end : Date;

    public constructor(start :Date, end : Date)
    {
        this._start = start;
        this._end = end;
    }

    // Expand this instance to include the given time. 
    public expandToInclude(time :Date) {
        if (time < this._start) {
            this._start = time;
        }
        if (time > this._end) {
            this._end = time;
        }
    }

    public getStart() : Date { return this._start; }
    public getEnd() : Date { return this._end; }

    public getDurationSeconds() : number { 
        var diffMS = this._end.valueOf() - this._start.valueOf();
        return diffMS / 1000;
    }

    public getDurationSecondsPretty() : string { 
        return TimeRange.prettyPrintSeconds(this.getDurationSeconds());
    }
    
    public static prettyPrintSeconds(delta : number) : string {         
        var ps, pm, ph, pd, min, hou, sec, days;
    
        if(delta<=59){
            ps = (delta>1) ? "s": "";
            return delta+" second"+ps
        }
    
        if(delta>=60 && delta<=3599){
            min = Math.floor(delta/60);
            sec = delta-(min*60);
            pm = (min>1) ? "s": "";
            ps = (sec>1) ? "s": "";
            return min+" minute"+pm+" "+sec+" second"+ps;
        }
    
        if(delta>=3600 && delta<=86399){
            hou = Math.floor(delta/3600);
            min = Math.floor((delta-(hou*3600))/60);
            ph = (hou>1) ? "s": "";
            pm = (min>1) ? "s": "";
            return hou+" hour"+ph+" "+min+" minute"+pm;
        } 
    
        if(delta>=86400){
            days = Math.floor(delta/86400);
            hou =  Math.floor((delta-(days*86400))/60/60);
            pd = (days>1) ? "s": "";
            ph = (hou>1) ? "s": "";
            return days+" day"+pd+" "+hou+" hour"+ph;
        }    
    }


    public static roundToDay(date : Date) : Date {
        var p = 24 * 60 * 60 * 1000; // milliseconds in a day 
        return new Date(Math.round(date.getTime() / p ) * p);
      }

    // Invoke a callback on each day in this range. 
    public forEachDay(callback : (time:TimeRange) => void) : void {        

        // $$$ Timezone adjust? 

        var x = TimeRange.roundToDay(this._start);
        
        while(x < this._end)
        {
            var ms = x.getTime() + 86400000;
            var tomorrow = new Date(ms);

            callback(new TimeRange(x, tomorrow));
            x = tomorrow;
        }
    }

    public toString = () : string => 
    {
        // toISOString   2015-03-25T07:00:00.000Z
        // toDateString  Wed Mar 25 2015
        // toTimeString  00:00:00 GMT-0700 (Pacific Daylight Time)
        // toUTCString   Wed, 25 Mar 2015 07:00:00 GMT
        return "" + this._start.toISOString() + " ... " + 
        this._end.toISOString() + " (" + this.getDurationSecondsPretty() +")";
    };

}

// simpler counter 
export class Counter 
{
    _count : number;
    _total : number;

    public add(include : boolean) {
        this._count++;
        this._total++;
    }

    public getCount() { return this._count; }
    public getTotal() { return this._total; }

    public getPercentage() : string {
        return Counter.GetPercentage(this._count, this._total);
    }
    
    public static GetPercentage(top : number, bottom : number) : string {
        if (bottom == 0) {
            return "na";
        }
        return (Math.round(top*100*100 / bottom)/100).toString() + "%";
    }

    public toString = () : string => 
    {
        return this._count + " of " + this._total + " (" + this.getPercentage() + ")";
    };
}

interface IHashCount {
    [key: string]: boolean;
}

// A simple collection for counting unique items.
export class HashCount
{
    private _dict :  IHashCount = { };

    public Add(item: string) : void {
        this._dict[item] = true;
    }

    public getCount() : number {
        // https://stackoverflow.com/questions/8702219/how-to-get-javascript-hash-table-count
        return Object.keys(this._dict).length;
    }

    public getKeys() : string[] {
        return Object.keys(this._dict);
    }

    public forEach( callback : (key : string) => void ) : void 
    {
        var keys = Object.keys(this._dict);
        for(var i in keys) {
            var value = keys[i]

            callback(value);
        }
    }

    public toString = () : string => 
    {
        return this.getCount().toString();
    };
}

interface IDictStorage<TValue> {
    [key: string]: TValue;
}

export interface ISheetContents {
    [colName: string]: string[];
}

export class Dict2d<TValue> 
{
    private _data : Dict<TValue>
    private _key1s : HashCount;
    private _key2s : HashCount;

    public constructor()
    {
        this._data = new Dict<TValue>();
        this._key1s = new HashCount();
        this._key2s = new HashCount();
    }

    public add(key1 : string, key2 :string, value : TValue) : void {        
        this._key1s.Add(key1);
        this._key2s.Add(key2);
        this._data.add( Dict2d.Key(key1, key2), value);
    }

    static Key(key1 : string, key2 :string) : string {
        return key1 + "*" + key2;
    }

    public get(key1 : string, key2 :string) : TValue {        
        return this._data.get( Dict2d.Key(key1, key2));
    }

    public getKey1s() : string[] {
        return this._key1s.getKeys();
    } 

    public getKey2s() : string[] {
        return this._key2s.getKeys();
    } 

    // Flatten to a rectangle. 
    public toRect(name0 : string) : ISheetContents {
        var x: ISheetContents = { }
        
        var col0 : string[] = [];
        x[name0] = col0;

        this._key2s.forEach( k2 => { 
            var col : string[] = [];
            x[k2] = col;
        });        

        // Add rows 
        this._key1s.forEach( k1 => { 
            col0.push(k1);
            this._key2s.forEach( k2 => { 
                var col = x[k2];

                var val = this.get(k1, k2);
                if (!val) {
                    col.push("");
                } else {
                    col.push(val.toString());
                }
            });
        });

        return x;
    }
}

// Similar to a .net dictionary.
// JScript, keys must be strings. (case-sensitive). That solves the hashing/equality problem. 
export class Dict<TValue> 
{
    private _data : IDictStorage<TValue>;

    public constructor()
    {
        this._data = { };
    }

    // Replaces existing value
    public add(key : string, value : TValue) : void {
        this._data[key] = value;
    }

    // Returns undefined if not present 
    public get(key : string) : TValue {
        return this._data[key];
    } 

    // nop if not found. 
    public remove(key : string) : void {
        delete this._data[key];
    }
 
    public getCount() : number {
        return Object.keys(this._data).length;
    }

    public getKeys() : string[] {
        return Object.keys(this._data);
    }

    public getValues() : TValue[] {
        var result : TValue[] = [];
        for(var key in this._data) {
            result.push(this._data[key])
        }
        return result;
    }

    // Enumeration 
    // $$$ What if we mutate in the middle?
    public forEach( callback : (key : string, value : TValue) => void ) : void 
    {
        for(var key in this._data) {
            var value = this._data[key];

            callback(key, value);
        }
    }
}