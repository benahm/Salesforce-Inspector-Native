/**
 * Logs Viewer tool: lists debug logs with SOQL. The log body is not queryable,
 * so it opens in the standard Setup viewer.
 */
public with sharing class LogService {
  private static final Integer DEFAULT_ROWS = 200;
  private static final Integer MAX_ROWS = 1000;

  public class LogInfo {
    @AuraEnabled
    public String id;
    @AuraEnabled
    public String userId;
    @AuraEnabled
    public String userName;
    @AuraEnabled
    public String operation;
    @AuraEnabled
    public String request;
    @AuraEnabled
    public String application;
    @AuraEnabled
    public String status;
    @AuraEnabled
    public Integer size;
    @AuraEnabled
    public Integer durationMs;
    @AuraEnabled
    public Datetime startTime;

    @TestVisible
    LogInfo(ApexLog log) {
      this.id = log.Id;
      this.userId = log.LogUserId;
      this.userName = log.LogUser?.Name;
      this.operation = log.Operation;
      this.request = log.Request;
      this.application = log.Application;
      this.status = log.Status;
      this.size = log.LogLength;
      this.durationMs = log.DurationMilliseconds;
      this.startTime = log.StartTime;
    }
  }

  /**
   * Most recent logs first; only the running user's when onlyMine is true.
   */
  @AuraEnabled
  public static List<LogInfo> getLogs(Boolean onlyMine, Integer maxRows) {
    try {
      Integer rowLimit = maxRows == null ||
        maxRows <= 0
        ? DEFAULT_ROWS
        : Math.min(maxRows, MAX_ROWS);
      String soql =
        'SELECT Id, LogUserId, LogUser.Name, Operation, Request, Application,' +
        ' Status, LogLength, DurationMilliseconds, StartTime FROM ApexLog' +
        (onlyMine == true ? ' WHERE LogUserId = :userId' : '') +
        ' ORDER BY StartTime DESC LIMIT ' +
        rowLimit;
      List<LogInfo> result = new List<LogInfo>();
      for (
        ApexLog log : (List<ApexLog>) Database.queryWithBinds(
          soql,
          new Map<String, Object>{ 'userId' => UserInfo.getUserId() },
          AccessLevel.USER_MODE
        )
      ) {
        result.add(new LogInfo(log));
      }
      return result;
    } catch (Exception e) {
      throw InspectorException.toAura(e);
    }
  }
}
