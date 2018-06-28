// Evohome Status node
const evohome = require('./evohome.js');
const idx = (p, o) => p.reduce((xs, x) => (xs && xs[x]) ? xs[x] : null, o);


module.exports = function(RED) {
    'use strict';

    function Node(n) {
      
        RED.nodes.createNode(this,n);
        var confignode = RED.nodes.getNode(n.confignode); 
        var node = this;
        this.interval = parseInt(n.interval);

        function publishEvohomeStatus() {
            evohome.login(confignode.userid, confignode.passwd, confignode.applid).then(function(session) {
	        session.getLocations().then(function(locations) {
                    locations[0].devices.forEach(function(device) {
                    	console.log('Trying to publish');
                    	console.dir(device);
                        if (device.thermostat) {
                            var msgout = {
                            	payload : {
                                id : device.deviceID,
                                name : device.name.toLowerCase() || device.thermostatModelType,
                                temperature : device.thermostat.indoorTemperature,
                                setpoint : idx(['thermostat','changeableValues','heatSetpoint','value'],device),
                                source : device,
                                mode : idx(['thermostat','changeableValues','mode'],device),
                                status : idx(['thermostat','changeableValues','status'],device) || idx(['thermostat','changeableValues','heatSetpoint','status'],device),
                                alive : device.isAlive 
                                }
                         	}
                            node.send(msgout);
                        }
                    });
                }).fail(function(err) {
                    node.warn(err);
                });
            }).fail(function(err) {
                node.warn(err);
            });
        }

        var tick = setInterval(function() {
            publishEvohomeStatus();
        }, this.interval*60000); // trigger every 30 secs
        
        node.on("close", function() {
            if (tick) {
                clearInterval(tick);
            }
        });
    }

    RED.nodes.registerType('evohome-status', Node);
};
