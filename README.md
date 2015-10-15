# Lambda Service Watcher

This lambda function is designed to work in conjunction with the Service Watcher Worker System. This function integrates with AWS Cloudformation, enabling the definition of Watchers that poll a HTTP endpoint and emit Cloud Watch Metrics.

## Reference

Use the `Custom::ServiceWatcher` task inside your Cloudformation, to define Watchers.

A watcher Accepts two parameters:
```URL``` which the the URL endpoint to poll.  The watcher assumes that the endpoint will return an array response.  The Watcher will count the elements in the response and emit a Cloud Watch metric called ```MetricName``` along with the count and a Unit of 'Count'.

```
{
  "Type" : "AWS::CloudFormation::CustomResource",
  "Properties" : {
    "ServiceToken" : * <String> [The Watcher Lambda Function ARN],
    "Table" : * <String> [Name of the DynamoDB Table to add this watcher to],
    "Region" : * <String> [AWS Region],
    "ServiceWatcher" : {
      "URL" : * <String> [Full URL to the endpoint i.e. http://example.com/count],
      "MetricName" : * <String> [Name of the Metric to be emitted]
    }
  }
}
```

**Note:** All asteriks (*) denote a required field.
