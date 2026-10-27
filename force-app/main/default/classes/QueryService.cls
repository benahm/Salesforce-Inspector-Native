/**
 * Runs read-only SOQL queries for Data Export.
 * Queries run in USER_MODE: the user only gets rows and fields they can already see.
 */
public with sharing class QueryService {
  public static final Integer MAX_ROWS_LIMIT = 10000;
  // Stop reading before serialization can exhaust the synchronous heap.
  private static final Decimal HEAP_RATIO = 0.4;

  private static final Pattern COUNT_ONLY = Pattern.compile(
    '(?i)^SELECT\\s+COUNT\\(\\s*\\)\\s+FROM\\s'
  );

  public class QueryResult {
    @AuraEnabled
    public String recordsJson;
    @AuraEnabled
    public Integer size;
    @AuraEnabled
    public Boolean hasMore = false;
    @AuraEnabled
    public Boolean truncatedByHeap = false;
    @AuraEnabled
    public Integer count;
    @AuraEnabled
    public Long elapsedMs;
  }

  @AuraEnabled
  public static QueryResult runQuery(String soql, Integer maxRows) {
    try {
      String query = normalize(soql);
      Integer rowLimit = (maxRows == null ||
        maxRows < 1)
        ? 2000
        : Math.min(maxRows, MAX_ROWS_LIMIT);
      Long start = System.currentTimeMillis();

      QueryResult result = new QueryResult();
      if (COUNT_ONLY.matcher(query).find()) {
        result.count = Database.countQueryWithBinds(
          query,
          new Map<String, Object>(),
          AccessLevel.USER_MODE
        );
        result.size = 0;
        result.recordsJson = '[]';
      } else {
        List<SObject> records = readRecords(query, rowLimit, result);
        result.size = records.size();
        result.recordsJson = JSON.serialize(records);
      }
      result.elapsedMs = System.currentTimeMillis() - start;
      return result;
    } catch (Exception e) {
      throw InspectorException.toAura(e);
    }
  }

  private static String normalize(String soql) {
    String query = soql == null ? '' : soql.trim();
    query = query.removeEnd(';').trim();
    if (!query.toUpperCase().startsWith('SELECT')) {
      throw new InspectorException('Only SELECT queries are allowed.');
    }
    return query;
  }

  private static List<SObject> readRecords(
    String query,
    Integer rowLimit,
    QueryResult result
  ) {
    Database.QueryLocator locator;
    try {
      locator = Database.getQueryLocatorWithBinds(
        query,
        new Map<String, Object>(),
        AccessLevel.USER_MODE
      );
    } catch (QueryException e) {
      // Aggregate queries are not supported by query locators.
      if (!e.getMessage().containsIgnoreCase('aggregate')) {
        throw e;
      }
      List<SObject> rows = Database.queryWithBinds(
        query,
        new Map<String, Object>(),
        AccessLevel.USER_MODE
      );
      if (rows.size() > rowLimit) {
        result.hasMore = true;
        List<SObject> limited = new List<SObject>();
        for (Integer i = 0; i < rowLimit; i++) {
          limited.add(rows[i]);
        }
        return limited;
      }
      return rows;
    }

    Integer heapBudget = (Integer) (Limits.getLimitHeapSize() * HEAP_RATIO);
    List<SObject> records = new List<SObject>();
    Database.QueryLocatorIterator iterator = locator.iterator();
    while (iterator.hasNext()) {
      if (records.size() >= rowLimit) {
        result.hasMore = true;
        break;
      }
      if (Limits.getHeapSize() > heapBudget) {
        result.hasMore = true;
        result.truncatedByHeap = true;
        break;
      }
      records.add(iterator.next());
    }
    return records;
  }
}
