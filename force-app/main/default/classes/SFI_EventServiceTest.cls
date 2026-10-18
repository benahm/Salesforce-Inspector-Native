@IsTest
private class SFI_EventServiceTest {
  @IsTest
  static void getChannelsListsStandardEvents() {
    List<SFI_EventService.Channel> channels = SFI_EventService.getChannels(
      'standardPlatformEvent'
    );
    Assert.isFalse(channels.isEmpty(), 'Standard events should be listed');
    Assert.isTrue(channels[0].path.startsWith('/event/'));
  }

  @IsTest
  static void getChannelsStartsChangeEventsWithAll() {
    List<SFI_EventService.Channel> channels = SFI_EventService.getChannels(
      'changeEvent'
    );
    Assert.areEqual('/data/ChangeEvents', channels[0].path);
  }

  @IsTest
  static void getChannelsAcceptsCustomEvents() {
    for (
      SFI_EventService.Channel channel : SFI_EventService.getChannels(
        'platformEvent'
      )
    ) {
      Assert.isTrue(channel.path.endsWith('__e'));
    }
  }

  @IsTest
  static void getChannelsRejectsUnknownType() {
    try {
      SFI_EventService.getChannels('nope');
      Assert.fail('An exception was expected');
    } catch (AuraHandledException e) {
      Assert.isTrue(e.getMessage().contains('nope'));
    }
  }
}
