console.log('Loading function');

exports.handler = function(event, context) {
  // dependencies
  var aws = require('aws-sdk');
  var uuid = require('node-uuid');
  var _ = require('underscore');

  // set variables
  var region = event.ResourceProperties.Region;
  var table = event.ResourceProperties.Table;

  var response, dynamo;
  dynamo = new aws.DynamoDB({ region: region });
  console.log(dynamo);

  response = {
    SUCCESS: "SUCCESS",
    FAILED: 'FAILED',
    send: function(event, context, responseStatus, responseData, physicalResourceId) {
      console.log('event, context, responseStatus, responseData, physicalResourceId');

      var response_reason = "See the details in CloudWatch Log Stream: " + context.logStreamName;

      if (!_.isUndefined(responseData) && !_.isUndefined(responseData.reason)) {
        response_reason = responseData.reason;
      }

      var responseBody = JSON.stringify({
          Status: responseStatus,
          Reason: response_reason,
          PhysicalResourceId: physicalResourceId || context.logStreamName,
          StackId: event.StackId,
          RequestId: event.RequestId,
          LogicalResourceId: event.LogicalResourceId,
          Data: responseData
      });

      console.log("Response body:\n", responseBody);

      var https = require("https");
      var url = require("url");

      var parsedUrl = url.parse(event.ResponseURL);
      var options = {
          hostname: parsedUrl.hostname,
          port: 443,
          path: parsedUrl.path,
          method: "PUT",
          headers: {
              "content-type": "",
              "content-length": responseBody.length
          }
      };

      var request = https.request(options, function(response) {
          console.log("Status code: " + response.statusCode);
          console.log("Status message: " + response.statusMessage);
          context.done();
      });

      request.on("error", function(error) {
          console.log("send(..) failed executing https.request(..): " + error);
          context.done();
      });

      request.write(responseBody);
      request.end();
    }
  };

  // batch create inside Dynamo
  var create_record = function(properties, fn) {
    console.log('create_record');
    properties.Id = uuid.v4();
    var obj = {
      TableName: table,
      Item: item(properties)
    };
    console.log(obj);
    var result = dynamo.putItem(obj, fn);
    console.log(result);
    return result;
  };

  // batch update  inside Dynamo
  var update_record = function(properties, fn) {
    properties.Id = event.PhysicalResourceId;
    var obj = {
      TableName: table,
      Item: item(properties)
    };
    var result = dynamo.putItem(obj, fn);
    return result;
  };

  // batch delete tasks inside Dynamo
  var delete_record = function(properties, fn) {
    properties.Id = event.PhysicalResourceId;
    var obj = {
      TableName: table,
      Key: key(properties)
    };
    var result = dynamo.deleteItem(obj, fn);
    return result;
  };

  // handle errors encountered
  var onError = function(err, data) {
    var resp = { Error: err };
    console.log(resp.Error + ':\\n', err);
    console.log(data);
    response.send(event, context, response.FAILED, resp);
  };


  var isWatcherValid = function(props, request_type) {
    if (request_type != "Delete") {
      if (_.isUndefined(props.ServiceWatcher)) {
        return [false, "ServiceWatcher has not been provided"];
      } else {
        var service_watcher = props.ServiceWatcher;
        if (_.isUndefined(service_watcher.URL)) {
          return [false, "URL must be provided"];
        }
        if (_.isUndefined(service_watcher.MetricName)) {
          return [false, "MetricName must be provided"];
        }
        if (_.isUndefined(service_watcher.Namespace)) {
          return [false, "Namespace must be provided"];
        }
      }
    }
    return [true, ''];
  };

  var key = function(props) {
    return {
      id: {
        S: props.Id
      }
    };
  };

  var item = function(props) {
    return {
      id: { S: props.Id },
      service_watcher: { S: JSON.stringify(props.ServiceWatcher) },
      last_updated: { S: new Date().toISOString() }
    };

  };

  // map the new and old resource definitions
  var props = event.ResourceProperties;
  var oldProps = event.OldResourceProperties;

  var validity = isWatcherValid(props, event.RequestType);
  console.log('valid, reason');
  console.log(validity[0], validity[1]);
  if (validity[0]) {
    switch(event.RequestType) {
      case 'Create':
        create_record(props, function(err, data) {
          if (err) onError('Create call failed', data);
          else response.send(event, context, response.SUCCESS, {}, props.Id);
        });
        break;
      case 'Update':
        update_record(props, function(err, data) {
          if (err) onError('Update call failed', data);
          else response.send(event, context, response.SUCCESS, {}, props.Id);
        });
        break;
      case 'Delete':
        // delete the tasks
        delete_record(props, function(err, data) {
          if (err) onError('Delete call failed', data);
          else response.send(event, context, response.SUCCESS, {}, props.Id);
        });
        break;
    }
  } else {
    response.send(event, context, response.FAILED, {
      reason: validity[1]
    });
  }
};
