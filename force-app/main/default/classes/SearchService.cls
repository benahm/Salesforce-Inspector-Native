/**
 * Searches objects and setup metadata from the launcher.
 */
public with sharing class SearchService {
  private static final Integer MAX_RESULTS = 25;

  public class SearchResult {
    @AuraEnabled
    public String id;
    @AuraEnabled
    public String name;
    @AuraEnabled
    public String detail;
    @AuraEnabled
    public String url;

    public SearchResult(String id, String name, String detail, String url) {
      this.id = id;
      this.name = name;
      this.detail = detail;
      this.url = url;
    }
  }

  @AuraEnabled
  public static List<SearchResult> search(
    String metadataType,
    String searchTerm
  ) {
    try {
      String term = searchTerm == null ? '' : searchTerm.trim();
      switch on metadataType {
        when 'Object' {
          return searchObjects(term);
        }
        when 'ApexClass' {
          return searchApex('ApexClass', 'ApexClasses', term);
        }
        when 'ApexTrigger' {
          return searchApex('ApexTrigger', 'ApexTriggers', term);
        }
        when 'ApexPage' {
          return searchApexPages(term);
        }
        when 'Flow' {
          return searchFlows(term);
        }
        when else {
          throw new InspectorException(
            'Unsupported metadata type: ' + metadataType
          );
        }
      }
    } catch (Exception e) {
      throw InspectorException.toAura(e);
    }
  }

  private static List<SearchResult> searchObjects(String term) {
    String lowerTerm = term.toLowerCase();
    List<SearchResult> results = new List<SearchResult>();
    Map<String, Schema.SObjectType> globalDescribe = Schema.getGlobalDescribe();
    List<String> names = new List<String>(globalDescribe.keySet());
    names.sort();
    for (String name : names) {
      Schema.DescribeSObjectResult d = globalDescribe.get(name)
        .getDescribe(SObjectDescribeOptions.DEFERRED);
      if (!d.isAccessible() || !d.isQueryable()) {
        continue;
      }
      if (
        String.isNotBlank(lowerTerm) &&
        !d.getName().toLowerCase().contains(lowerTerm) &&
        !d.getLabel().toLowerCase().contains(lowerTerm)
      ) {
        continue;
      }
      results.add(
        new SearchResult(
          d.getName(),
          d.getName(),
          d.getLabel() +
          (d.getKeyPrefix() == null ? '' : ' • ' + d.getKeyPrefix()),
          '/lightning/setup/ObjectManager/' + d.getName() + '/Details/view'
        )
      );
      if (results.size() >= MAX_RESULTS) {
        break;
      }
    }
    return results;
  }

  private static List<SearchResult> searchApex(
    String objectName,
    String setupPage,
    String term
  ) {
    String soql =
      'SELECT Id, Name, Status, ApiVersion FROM ' +
      objectName +
      ' WHERE NamespacePrefix = null';
    if (String.isNotBlank(term)) {
      soql += ' AND Name LIKE :likeTerm';
    }
    soql += ' ORDER BY Name LIMIT ' + MAX_RESULTS;
    List<SearchResult> results = new List<SearchResult>();
    for (SObject row : query(soql, term)) {
      results.add(
        new SearchResult(
          row.Id,
          (String) row.get('Name'),
          row.get('Status') + ' • API ' + row.get('ApiVersion'),
          '/lightning/setup/' + setupPage + '/page?address=%2F' + row.Id
        )
      );
    }
    return results;
  }

  private static List<SearchResult> searchApexPages(String term) {
    String soql = 'SELECT Id, Name, MasterLabel, ApiVersion FROM ApexPage WHERE NamespacePrefix = null';
    if (String.isNotBlank(term)) {
      soql += ' AND (Name LIKE :likeTerm OR MasterLabel LIKE :likeTerm)';
    }
    soql += ' ORDER BY Name LIMIT ' + MAX_RESULTS;
    List<SearchResult> results = new List<SearchResult>();
    for (SObject row : query(soql, term)) {
      results.add(
        new SearchResult(
          row.Id,
          (String) row.get('Name'),
          row.get('MasterLabel') + ' • API ' + row.get('ApiVersion'),
          '/lightning/setup/ApexPages/page?address=%2F' + row.Id
        )
      );
    }
    return results;
  }

  // FlowDefinitionView does not support OR: API name and label matches are queried separately.
  private static List<SearchResult> searchFlows(String term) {
    String soql = 'SELECT DurableId, ApiName, Label, ProcessType, IsActive FROM FlowDefinitionView';
    String orderAndLimit = ' ORDER BY ApiName LIMIT ' + MAX_RESULTS;
    Map<String, SObject> rowsByApiName = new Map<String, SObject>();
    if (String.isBlank(term)) {
      for (SObject row : query(soql + orderAndLimit, term)) {
        rowsByApiName.put((String) row.get('ApiName'), row);
      }
    } else {
      for (
        String filter : new List<String>{
          ' WHERE ApiName LIKE :likeTerm',
          ' WHERE Label LIKE :likeTerm'
        }
      ) {
        for (SObject row : query(soql + filter + orderAndLimit, term)) {
          rowsByApiName.put((String) row.get('ApiName'), row);
        }
      }
    }
    List<String> apiNames = new List<String>(rowsByApiName.keySet());
    apiNames.sort();
    List<SearchResult> results = new List<SearchResult>();
    for (String apiName : apiNames) {
      if (results.size() >= MAX_RESULTS) {
        break;
      }
      SObject row = rowsByApiName.get(apiName);
      String durableId = (String) row.get('DurableId');
      Boolean isActive = (Boolean) row.get('IsActive');
      results.add(
        new SearchResult(
          durableId,
          (String) row.get('ApiName'),
          row.get('Label') +
            ' • ' +
            row.get('ProcessType') +
            (isActive ? ' • Active' : ' • Inactive'),
          '/lightning/setup/Flows/page?address=%2F' + durableId
        )
      );
    }
    return results;
  }

  private static List<SObject> query(String soql, String term) {
    return Database.queryWithBinds(
      soql,
      new Map<String, Object>{ 'likeTerm' => '%' + term + '%' },
      AccessLevel.USER_MODE
    );
  }
}
