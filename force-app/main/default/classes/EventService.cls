/**
 * Event Monitor tool: lists the channels a user can subscribe to with
 * lightning/empApi. Reads EntityDefinition only (no Tooling API), so custom
 * channels and real-time events are typed by hand in the monitor.
 */
public with sharing class EventService {
  private static final String STANDARD_EVENTS =
    'SELECT QualifiedApiName, Label FROM EntityDefinition' +
    ' WHERE IsCustomizable = FALSE AND IsEverCreatable = TRUE' +
    ' AND QualifiedApiName LIKE \'%Event\'' +
    ' AND (NOT QualifiedApiName LIKE \'%ChangeEvent\')' +
    ' ORDER BY Label LIMIT 500';
  private static final String CUSTOM_EVENTS =
    'SELECT QualifiedApiName, Label FROM EntityDefinition' +
    ' WHERE IsCustomizable = TRUE AND KeyPrefix LIKE \'e%\'' +
    ' ORDER BY Label LIMIT 500';
  private static final String CHANGE_EVENTS =
    'SELECT QualifiedApiName, Label FROM EntityDefinition' +
    ' WHERE QualifiedApiName LIKE \'%ChangeEvent\'' +
    ' ORDER BY Label LIMIT 1000';

  public class Channel {
    @AuraEnabled
    public String label;
    @AuraEnabled
    public String path;

    Channel(String label, String path) {
      this.label = label;
      this.path = path;
    }
  }

  /**
   * channelType: standardPlatformEvent, platformEvent or changeEvent.
   */
  @AuraEnabled
  public static List<Channel> getChannels(String channelType) {
    try {
      List<Channel> result = new List<Channel>();
      String query;
      String prefix = '/event/';
      if (channelType == 'standardPlatformEvent') {
        query = STANDARD_EVENTS;
      } else if (channelType == 'platformEvent') {
        query = CUSTOM_EVENTS;
      } else if (channelType == 'changeEvent') {
        query = CHANGE_EVENTS;
        prefix = '/data/';
        result.add(new Channel('All Change Events', '/data/ChangeEvents'));
      } else {
        throw new InspectorException('Unknown channel type: ' + channelType);
      }
      // A SOQL for loop fetches in chunks, and EntityDefinition has no queryMore()
      List<EntityDefinition> entities = Database.query(query);
      for (EntityDefinition entity : entities) {
        result.add(new Channel(entity.Label, prefix + entity.QualifiedApiName));
      }
      return result;
    } catch (Exception e) {
      throw InspectorException.toAura(e);
    }
  }
}
