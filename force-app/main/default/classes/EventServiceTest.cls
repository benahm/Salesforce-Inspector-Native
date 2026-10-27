@IsTest
private class EventServiceTest {
  @IsTest
  static void getChannelsListsStandardEvents() {
    List<EventService.Channel> channels = EventService.getChannels(
      'standardPlatformEvent'
    );
    Assert.isFalse(channels.isEmpty(), 'Standard events should be listed');
    Assert.isTrue(channels[0].path.startsWith('/event/'));
  }

  @IsTest
  static void getChannelsStartsChangeEventsWithAll() {
    List<EventService.Channel> channels = EventService.getChannels(
      'changeEvent'
    );
    Assert.areEqual('/data/ChangeEvents', channels[0].path);
  }

  @IsTest
  static void getChannelsAcceptsCustomEvents() {
    for (
      EventService.Channel channel : EventService.getChannels('platformEvent')
    ) {
      Assert.isTrue(channel.path.endsWith('__e'));
    }
  }

  @IsTest
  static void getChannelsRejectsUnknownType() {
    try {
      EventService.getChannels('nope');
      Assert.fail('An exception was expected');
    } catch (AuraHandledException e) {
      Assert.isTrue(e.getMessage().contains('nope'));
    }
  }
}
