// Group by precinct 

import * as bcl from './collections'
import * as sh from 'trc-sheet/sheetContents'
import * as hh from './household'
import { ColumnNames } from 'trc-sheet/sheetContents'

// Describe stats for a precinct. 
// $$$ General this to any child sheet?
export class Precinct{
    public constructor(name : string) {
        this.Name = name;        
        this.HouseholdCount = new bcl.HashCount();
        this.ContactHouseholdCount = new bcl.HashCount();
        this.Count = 0;
        this.GOPCount = 0;
        this.DEMCount = 0;
        this.ContactCount = 0;
        this.Targets =0;
    }

    public Name  :string; // name of this precinct 
    public Count : number; // total people in the precinct 
    public HouseholdCount : bcl.HashCount ; // Total households
    public GOPCount : number;
    public DEMCount : number;
    
    public getGOPPercent() { 
        return bcl.Counter.GetPercentage(this.GOPCount, (this.GOPCount + this.DEMCount));
    }

    public ContactCount : number;  // # of people we've contacted 
    public ContactHouseholdCount : bcl.HashCount;  // # of people we've contacted 
    public Targets : number; // # of targeted people in this district

    public applyParty(val : string) : void {
        if (val == "1" || val == "2") {
            this.GOPCount++;
        } else if (val == "4" || val == "5") {
            this.DEMCount++;
        }
    }
}



export class BuildPrecinctReport
{
    public static convert(array:  Precinct[]) : sh.ISheetContents {

        var x : sh.ISheetContents = { };

        var names : string[] = [];
        x["Names"] = names;

        var count : string[] = [];
        x["count"] = count;

        var HouseholdCount : string[] = [];
        x["HouseholdCount"] = HouseholdCount;

        var GOPCount : string[] = [];
        x["GOPCount"] = GOPCount;

        var DEMCount : string[] = [];
        x["DEMCount"] = DEMCount;

        var GOPPercent : string[] = [];
        x["GOPPercent"] = GOPPercent;

        var ContactCount : string[] = [];
        x["ContactCount"] = ContactCount;

        var ContactHouseholdCount : string[] = [];
        x["ContactHouseholdCount"] = ContactHouseholdCount;

        var Targets : string[] = [];
        x["Targets"] = Targets;

        for(var i in array)
        {
            var precinct = array[i];

            names.push(precinct.Name);
            count.push(precinct.Count.toString());
            HouseholdCount.push(precinct.HouseholdCount.toString());
            GOPCount.push(precinct.GOPCount.toString());
            DEMCount.push(precinct.DEMCount.toString());
            GOPPercent.push(precinct.getGOPPercent());
            ContactCount.push(precinct.ContactCount.toString());
            ContactHouseholdCount.push(precinct.ContactHouseholdCount.toString());
            Targets.push(precinct.Targets.toString());
        }        

        return x;
    }

    public build(data : sh.ISheetContents) : Precinct[] {

        var list : bcl.Dict<Precinct> = new bcl.Dict<Precinct>();
        var householder = new hh.Householding(data);

        var recIds = data[ColumnNames.RecId];
        var precincts = data[ColumnNames.PrecinctName];
        var partyColumn = data[ColumnNames.Party];

        var xtargerColumn = data[ColumnNames.XTargetPri]; // Optional

        // Contact is trickier. $$$
        var contacts : string[] = data["ResultOfContact"];

        for(var i in recIds)
        {
            var recId = recIds[i];
            var precinctName = precincts[i];

            var p : Precinct = list.get(precinctName);
            if (!p) {
                p = new Precinct(precinctName);
                list.add(precinctName, p);
            }

            p.Count++;
            
            var hhid  = householder.getHHID(recId);
            p.HouseholdCount.Add(hhid);

            var party = partyColumn[i];
            p.applyParty(party);

            if (!!xtargerColumn) {
                var target = xtargerColumn[i];
                if (target == "1") {
                    p.Targets++;
                }
            }            

            if (!!contacts) {
                var contact = contacts[i];
                if (contact.length > 0) {
                    p.ContactCount++;
                    p.ContactHouseholdCount.Add(hhid);
                }
            }
        }

        return list.getValues();
    }
}