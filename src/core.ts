
import * as bcl from './collections'
import * as sh from 'trc-sheet/sheetContents'
import { ColumnNames } from 'trc-sheet/sheetContents'
import * as trcSheet from 'trc-sheet/sheet'
import { SheetContentsIndex, SheetContents, ISheetContents } from 'trc-sheet/sheetContents';
import * as hh from './household'


export class Cluster {
    private _time: bcl.TimeRange;
    private _recIds: bcl.HashCount = new bcl.HashCount();

    public constructor(startTime: Date) {
        this._time = new bcl.TimeRange(startTime, startTime);
    }

    // Timespan for this cluster
    public getTimeRange(): bcl.TimeRange { return this._time; }

    public getDurationSeconds(): number {
        return this.getTimeRange().getDurationSeconds();
    }

    public getUniqueCount(): number { return this._recIds.getCount(); }

    public getUniqueHouseholdCount(hh : hh.IHousheholding) : number { 
        var x = new bcl.HashCount();
        this._recIds.forEach(recId => x.Add(hh.getHHID(recId)));
        return x.getCount();
    };

    // A single version can contain multiple edits and timestamps. 
    public Apply(
        version: number,
        recId: string,
        lat: string,
        long: string,
        timestamp: Date) {

        this._recIds.Add(recId);
        this._time.expandToInclude(timestamp);

    }

}


// Represent a set of changes. 
// Index here is version #. 
// $$$ IS this continuous?
export class Changelist {

    private _deltas: trcSheet.IDeltaInfo[]; // all the raw deltas. 

    // Filters, null if not set. 
    private _filterUser: string;  // Only include changes for this user. 

    // Calculated 
    private _users: bcl.HashCount; // List of users in this sheet. 
    private _timeRange: bcl.TimeRange;  // span for this entire set 
    private _count: number;

    public constructor(deltas: trcSheet.IDeltaInfo[], filterUser?: string) {
        this._deltas = deltas;
        this._filterUser = filterUser;

        this._users = new bcl.HashCount();
        this._count = 0;

        // Init stats, uses filters. 
        this.forEach(delta => {
            this._count++;
            this._users.Add(delta.User);
            var d = new Date(delta.Timestamp);
            if (!this._timeRange) {
                this._timeRange = new bcl.TimeRange(d, d);
            } else {
                this._timeRange.expandToInclude(d);
            }
        });
    }

    public toString = () : string => 
    {
        var x= this._count + " changes";
        if (!!this._filterUser) {
            x += " for user '" + this._filterUser + "'.";
        }
        return x;
    };

    public getDeltaCount(): number { return this._count; }

    // Get unique list of users contributing in this changelist. 
    public getUsers(): string[] {
        return this._users.getKeys();
    }

    // Get the underlying deltas. These are very low-level. 
    // Beware that:
    // -  a single version can edit multiple RecIds. 
    // -  geo information may be in the version or in the headers.  
    // public getAll(): trcSheet.IDeltaInfo[] { return this._deltas; }

    // public get(ver: number): trcSheet.IDeltaInfo { }

    // Get the timerange that this delta spans
    public getTimeRange(): bcl.TimeRange { return this._timeRange; }


    // Return a username --> ChangeList dictionary 
    public filterByUser(): bcl.Dict<Changelist> {
        var x = new bcl.Dict<Changelist>();
        this._users.forEach(user => {
            x.add(user, new Changelist(this._deltas, user));
        });
        return x;
    }

    /*
        // Filters. 
        public filterByTime(range: TimeRange): Changelist {
    
        }
    
        public filterByUser(username: string): Changelist {
    
        }
    */

    private forEach(callback: (item: trcSheet.IDeltaInfo) => void): void {
        this._deltas.forEach(x => {
            if (!!this._filterUser) {
                if (this._filterUser != x.User) {
                    return;
                }
            }
            callback(x)
        });
    }

    // Flatten to a rectangle, indexed by RecId. 
    // Columns include the questions and metadata information (app, userid, timestamp, geo)
    // $$$ same cell is edited multiple times? By different users?
    // $$$ Timerange per RecId? And detect range > threshold? 
    // (This is like what Blame2 shows)
    public flattenByRecId(): ISheetContents {

        var d2 = new bcl.Dict2d<string>();

        this.forEach(item => {
            SheetContents.ForEach(
                item.Value, (recId, columnName, newValue) => {

                    // Common properties 
                    d2.add(recId, ColumnNames.XUser, item.User);
                    d2.add(recId, ColumnNames.XApp, item.App);
                    d2.add(recId, ColumnNames.XIPAddress, item.UserIp);

                    // $$$ Include Lat,Long,Timestamp 

                    d2.add(recId, columnName, newValue);
                });
        });

        var x = d2.toRect(ColumnNames.RecId);
        return x;
    }


    // Flatten and normalize. A single version can edit multiple columns and RecIds.
    // This will "unroll" that into a single flat list.  
    // Rows "Version-SubVersion"
    // Columns: Column, NewValue, $system coluns,. 
    public normalizeByVer(): ISheetContents {
        var map = new bcl.Dict<ExtraInfo>(); // RecId --> ExtraInfo 

        var counter = 0;
        var cVersion: string[] = [];
        var cUser: string[] = [];
        var cLat: string[] = [];
        var cLong: string[] = [];
        var cTimestamp: string[] = [];
        var cUserIp: string[] = [];
        var cApp: string[] = [];
        var cChangeRecId: string[] = [];
        var cChangeColumn: string[] = [];
        var cChangeValue: string[] = [];

        var contents: ISheetContents = {};
        contents["Version"] = cVersion;
        contents[ColumnNames.XUser] = cUser;
        contents[ColumnNames.XLat] = cLat;
        contents[ColumnNames.XLong] = cLong;
        contents["Timestamp"] = cTimestamp;
        contents[ColumnNames.XIPAddress] = cUserIp;
        contents[ColumnNames.XApp] = cApp;
        contents[ColumnNames.RecId] = cChangeRecId;
        contents["ChangeColumn"] = cChangeColumn;
        contents["NewValue"] = cChangeValue;

        this.forEach(result => {
            SheetContents.ForEach(result.Value, (recId, columnName, newValue) => {
                var x: ExtraInfo = map.get(recId);
                if (!x) {
                    x = new ExtraInfo();
                    map.add(recId, x);
                }

                x.SetApp(result.App);
                x.SetUser(result.User);
                x.SetLat(result.GeoLat, result.GeoLong);
                x.SetTimestamp(result.Timestamp);
                x.SetIpAddress(result.UserIp);

                cVersion.push(result.Version.toString());
                cUser.push(result.User);
                cLat.push(result.GeoLat);
                cLong.push(result.GeoLong);
                cTimestamp.push(result.Timestamp);
                cUserIp.push(result.UserIp);
                cApp.push(result.App);

                cChangeRecId.push(recId);
                cChangeColumn.push(columnName);
                cChangeValue.push(newValue);

                if (columnName == ColumnNames.XLastModified) {
                    x.SetClientTimestamp(newValue);
                } else if (columnName == ColumnNames.XLat) {
                    x.SetClientLat(newValue);
                } else if (columnName == ColumnNames.XLong) {
                    x.SetClientLong(newValue);
                }
            });
        });

        return contents;
    }


    // Operations.

    // Given a change log, cluster it into sessions (based on continuous activity)
    // Invoke a householder to compute     
    public getClustering(): Cluster[] {

        var thresholdMs: number = 15 * 60 * 1000;

        var clusters: Cluster[] = [];

        var current: Cluster = null;

        this.forEach(item => {
            var timestamp: string = item.Timestamp;

            var lat = item.GeoLat;
            var long = item.GeoLong;

            var recIds = item.Value[ColumnNames.RecId];
            var colLats = item.Value[ColumnNames.XLat];
            var colLong = item.Value[ColumnNames.XLong];
            var colTimestamp = item.Value[ColumnNames.XLastModified];

            for (var i in recIds) {
                var recId = recIds[i];

                if (!!colLats) {
                    lat = colLats[i];
                }
                if (!!colLong) {
                    long = colLong[i];
                }
                if (!!colTimestamp) {
                    timestamp = colTimestamp[i];
                }

                // $$$ Analyze ... is the survey started/complete? 

                // Based on timestamp, is this a new cluster? 
                // $$$  What if they arrive out-of-order? NEed to sort by timestamp?
                var d = new Date(timestamp);

                if (!!current) {
                    var lastTime = current.getTimeRange().getEnd();
                    var diffMS: number = d.getTime() - lastTime.getTime();
                    if (diffMS > thresholdMs) {
                        // New 
                        current = null;
                    }
                }
                if (!current) {
                    current = new Cluster(d);
                    clusters.push(current);
                }


                // Apply each version.
                current.Apply(item.Version, recId, lat, long, d);
            }
        });

        return clusters;

    }

    /*

// Full-fidelity save to JSON? 

// Flatten and normalize. A single version can edit multiple columns and RecIds.
// This will "unroll" that into a single flat list.  
// Rows "Version-SubVersion"
// Columns: Column, NewValue, $system coluns,. 
public normalizeByVer(): DataRect { }
*/
}


// Information accumulated from change-log. 
class ExtraInfo {
    User: string;
    App: string;

    // These are "server" values, captured by when the server receives the request
    Timestamp: string;
    FirstDate: string; // $$$ Replace this with TimeRange 
    LastDate: string;
    IpAddress: string; // $$$ error: this is missing from the REST call. 

    // These are "client" values. Captured wehen the client recorded it. 
    // necessary in  offline scenarios, but could be spoofed. 
    ClientTimestamp: string;
    ClientLat: string;
    ClientLong: string;

    // These are provided when the client uploads (and hence once it's regained connectivity)
    Lat: string;
    Long: string;


    public SetUser(user: string): void {
        if (user != null) {
            this.User = user;
        }
    }

    public SetApp(app: string): void {
        if (app != null) {
            this.App = app;
        }
    }

    public SetIpAddress(ipAddress: string): void {
        if (!this.IpAddress) {
            this.IpAddress = ipAddress;
        }
    }

    // "Client" values are recorded by the client. 
    // These may be more accurate in offline scenarios. 
    // But a bad client could spoof them. 
    public SetClientTimestamp(timestamp: string): void {
        this.ClientTimestamp = timestamp;
    }
    public SetClientLat(lat: string): void {
        if (!this.ClientLat) {
            this.ClientLat = lat;
        }
    }
    public SetClientLong(long: string): void {
        if (!this.ClientLong) {
            this.ClientLong = long;
        }
    }

    public SetTimestamp(timestamp: string): void {
        this.Timestamp = timestamp;

        if (timestamp) {
            var ts = Date.parse(timestamp);
            if (!this.FirstDate) {
                this.FirstDate = timestamp;
            } else {
                var firstDateMS = Date.parse(this.FirstDate);
                if (ts < firstDateMS) {
                    this.FirstDate = timestamp;
                }
            }

            if (!this.LastDate) {
                this.LastDate = timestamp;
            } else {
                var lastDateMS = Date.parse(this.FirstDate);
                if (ts > lastDateMS) {
                    this.LastDate = timestamp;
                }
            }
        }

    }

    public SetLat(lat: string, long: string): void {
        if (lat != null && lat != "0") {
            this.Lat = lat;
            this.Long = long;
        }
    }
}


// Read-only interfaces for analyzing a sheet and its results. 
// Client for fetching raw data used in analysis. 
export class AnalyzeClient {
    private _uxcallback: (msg: string) => void;
    private _sheet: trcSheet.SheetClient;

    private _sheetInfo: trcSheet.ISheetInfoResult;
    private _sheetIndex: SheetContentsIndex; // includes contents

    private _deltas: trcSheet.IDeltaInfo[]; // all the raw deltas. 
    private _init: boolean;

    public constructor(sheetClient: trcSheet.SheetClient) {
        this._sheet = sheetClient;
        this._init = false;
    }

    // Set a callback to show progress during long network operations.
    public setProgressCallback(callback: (msg: string) => void): void {
        this._uxcallback = callback;
    }
    private setMessage(msg: string): void {
        if (!!this._uxcallback) {
            this._uxcallback(msg);
        }
    }

    private initAsync(): Promise<void> {
        if (this._init) {
            return Promise.resolve(); // Already init,
        }
        this._deltas = [];
        this.setMessage("getting sheet info");
        return this._sheet.getInfoAsync().then(info => {
            this._sheetInfo = info;

            this.setMessage("getting sheet contents (for " + info.CountRecords + " rows)");
            return this._sheet.getSheetContentsAsync().then(contents => {

                this._sheetIndex = new SheetContentsIndex(contents);

                this.setMessage("getting deltas");
                return this._sheet.getDeltaRangeAsync().then(iter => {
                    return iter.ForEach(item => {
                        this._deltas.push(item);
                    }).then(() => {
                        this._init = true;
                        this.setMessage(""); // Clear
                    });
                })
            });
        })
    }

    public getHouseholder() : Promise<hh.IHousheholding> {
        return this.initAsync().then(() => {
            var data = this._sheetIndex.getContents();
            return new hh.Householding(data);
        });
    }

    // Gets all changes in the sheet.
    // This can paginate and invoke the progress callback
    public getAllChangesAsync(): Promise<Changelist> {
        return this.initAsync().then(() => {
            return new Changelist(this._deltas);
        });
    }
}