// Helper for mapping a RecId to a HouseholdID (hhid). 

import * as bcl from './collections'
import * as sh from 'trc-sheet/sheetContents'
import { ColumnNames } from 'trc-sheet/sheetContents'

export interface IHousheholding {
    // Given a recId, get the  HHID (household id) it belongs to. 
    // The HHID can be used for finding # of doors, rather than # of individuals.  
    getHHID(recId : string) : string;
}

export class Householding implements IHousheholding 
{
    private _x : bcl.Dict<string>;

    public constructor(data : sh.ISheetContents) 
    {
        this._x = new bcl.Dict<string>();

        var recIds = data[ColumnNames.RecId];
        var adddresses = data[ColumnNames.Address];
        var cities = data[ColumnNames.City];
        var zips= data[ColumnNames.Zip];

        for(var i in recIds)
        {
            var recId = recIds[i];

            var addr = adddresses[i];
            var city = cities[i];
            var zip = zips[i];

            var hhid = Householding.calcHHID(addr, city, zip);
            this._x.add(recId, hhid);
        }
    }    
    
    public static calcHHID(addr : string, city : string, zip : string)  : string {
        var x = addr + city + zip;
        return x.toLowerCase();
    }

    public getHHID(recId : string) : string
    {
        return this._x.get(recId);
    }

}