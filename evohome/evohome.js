/*******************************************
 * This file is a modified version of evohome.js from
 * https://github.com/luc-ass/homebridge-evohome
 * If I did something wrong with the license, let me know!!
 */
const Q = require('q');
const request = require('request');
const _ = require('lodash');

function UserInfo(json) {
	console.log('->UserInfo');
	console.dir(json);
    this.userID = json.userID;
    this.username = json.username;
    this.firstname = json.firstname;
    this.lastname = json.lastname;
    this.streetAddress = json.streetAddress;
    this.city = json.city;
    this.state = json.state;
    this.zipcode = json.zipcode;
    this.country = json.country;
    this.telephone = json.telephone;
    this.userLanguage = json.userLanguage;
    this.isActivated = json.isActivated;
    this.deviceCount = json.deviceCount;
}

// Private
var sessionCredentials = {};

function Session(username, password, appId, json) {
    console.log('Session: ' + JSON.stringify(json));
    this.sessionId = json.sessionId;
    this.userInfo = new UserInfo(json.userInfo);
    console.log('-> Eula');
    this.latestEulaAccepted = json.latestEulaAccepted;

    sessionCredentials[this.sessionId] = {
        username: username,
        password: password,
        appId: appId
    };
}

function Location(json) {
	console.log('->location: FULL JSON BELOW');
	console.dir(json);
    this.locationID = json.locationID;
    this.name = json.name;
    this.streetAddress = json.streetAddress;
    this.city = json.city;
    this.state = json.state;
    this.country = json.country;
    this.zipcode = json.zipcode;
    this.type = json.type;
    //this.devices = _.map(json.devices, function(device) {
    //    return new Device(device);
    //});
    this.devices = _.map(json.devices, function(device) {
        return device;
    });
    
    this.oneTouchButtons = json.oneTouchButtons;
    this.daylightSavingTimeEnabled = json.daylightSavingTimeEnabled;
    this.timeZone = json.timeZone;
    this.oneTouchActionsSuspended = json.oneTouchActionsSuspended;
    this.evoTouchSystemsStatus = json.evoTouchSystemsStatus;
    this.isLocationOwner = json.isLocationOwner;
    this.locationOwnerName = json.locationOwnerName;
}

function Device(json) {
	console.log('->Device');
	console.dir(json);
    this.deviceID = json.deviceID;
    this.thermostatModelType = json.thermostatModelType;
    this.name = json.name;
    this.thermostat = new Thermostat(json.thermostat);
}

function Thermostat(json) {
	console.log('->Thermostat');
	console.dir(json);
    this.units = json.units;
    this.indoorTemperature = json.indoorTemperature;
    //this.outdoorTemperature = json.outdoorTemperature;
    this.allowedModes = json.allowedModes;
    //this.deadband = json.deadband;
    this.minHeatSetpoint = json.minHeatSetpoint;
    this.maxHeatSetpoint = json.maxHeatSetpoint;
    //this.minCoolSetpoint = json.minCoolSetpoint;
    //this.maxCoolSetpoint = json.maxCoolSetpoint;
    this.changeableValues = json.changeableValues;

}

Session.prototype.getLocations = function() {
	console.log('Get Locations');
    var url = "https://tccna.honeywell.com/WebAPI/api/locations?userId=" + this.userInfo.userID + "&allData=True";
    return this._request(url).then(function(json) {
        return _.map(json, function(location) {
            return new Location(location);
        });
    });
}

Session.prototype.modifyHeatSetpoint = function(deviceId, status, targetTemperature, minutes) {
    console.log('ModifyHeatSetPoint');
    var deferred = Q.defer();
    var url = "https://tccna.honeywell.com/WebAPI/api/devices/" + deviceId + "/thermostat/changeableValues/heatSetpoint";
    var body = null;
    if (status == "Temporary" && targetTemperature && minutes) {
        var now = new Date();
        var timezoneOffsetInMinutes = now.getTimezoneOffset();

        var endDate = new Date(now);
        endDate.setMinutes(endDate.getMinutes() - timezoneOffsetInMinutes + minutes);
        endDate.setSeconds(0);
        endDate.setMilliseconds(0);

        body = JSON.stringify({
            Value: targetTemperature,
            Status: "Temporary", // Temporary, Hold, Scheduled
            NextTime: endDate
        });
    } else if (status == "Hold" && targetTemperature) {
        body = JSON.stringify({
            Value: targetTemperature,
            Status: "Hold"
        });
    } else {
        body = JSON.stringify({
            Status: "Scheduled"
        });
    }

    request({
        method: 'PUT',
        url: url,
        headers: {
            'Content-Type': 'application/json',
            'sessionId': this.sessionId
        },
        body: body
    }, function(err, response) {
        if (err) {
            deferred.reject(err);
        } else {
            deferred.resolve(JSON.parse(response.body));
        }
    });
    return deferred.promise;
}

Session.prototype._renew = function() {
	console.log('_renew');
    var self = this;
    var credentials = sessionCredentials[this.sessionID];
    return login(credentials.username, credentials.password, credentials.appId).then(function(json) {
        self.sessionId = json.sessionId;
        self.userInfo = new UserInfo(json.userInfo);
        self.latestEulaAccepted = json.latestEulaAccepted;
        return self;
    });
}

Session.prototype._request = function(url) {
	console.log('_request');
    var deferred = Q.defer();
    request({
        method: 'GET',
        url: url,
        headers: {
            'Content-Type': 'application/json',
            'sessionID': this.sessionId
        }
    }, function(err, response) {
        if (err) {
            deferred.reject(err);
        } else {
            var json;
            try {
                json = JSON.parse(response.body);
            } catch (ex) {
                console.error(ex);
                console.error(response.body);
                console.error(response);
                deferred.reject(ex);
            }
            if (json) {
                deferred.resolve(json);
            }
        }
    });

    return deferred.promise;
}

function login(username, password, appId) {
	console.log('->Login');
    var deferred = Q.defer();

    var requestBody = {
        Username: username,
        Password: password,
        ApplicationID: appId
    };
    var requestJson = JSON.stringify(requestBody);
    request({
        method: 'POST',
        url: 'https://tccna.honeywell.com/WebAPI/api/Session',
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
        },
        body: requestJson
    }, function(err, response) {
        if (err) {
        	console.log(err);
            deferred.reject(err);
        } else {
        	console.log(response.body);
        	try {
           		deferred.resolve(JSON.parse(response.body));
           	}
           	catch (err) {
           		console.log('Caught Error ' + err + ' in response.body:'+response.body);
           		deferred.reject(err);
           	}	
        }
    });
    return deferred.promise;
}

module.exports = {
    login: function(username, password, appId) {
        return login(username, password, appId).then(function(json) {
            return new Session(username, password, appId, json);
        });
    }
};
