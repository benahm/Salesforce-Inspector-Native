@IsTest
private class SFI_ImportServiceTest {
  private static List<SFI_ImportService.RowResult> run(
    String operation,
    String externalIdField,
    List<Map<String, String>> rows,
    Boolean validateOnly
  ) {
    return SFI_ImportService.importBatch(
      'Contact',
      operation,
      externalIdField,
      rows,
      false,
      validateOnly,
      0
    );
  }

  @IsTest
  static void insertReportsSuccessAndErrorsPerRow() {
    List<SFI_ImportService.RowResult> results = run(
      'insert',
      null,
      new List<Map<String, String>>{
        new Map<String, String>{
          'LastName' => 'SFI One',
          'Birthdate' => '1990-05-17'
        },
        new Map<String, String>{
          'LastName' => 'SFI Two',
          'Birthdate' => 'not a date'
        }
      },
      false
    );
    Assert.areEqual(2, results.size());
    Assert.isTrue(results[0].success, '' + results[0].error);
    Assert.isTrue(results[0].created);
    Assert.isFalse(results[1].success);
    Assert.isTrue(results[1].error.contains('Birthdate'), results[1].error);
    Assert.areEqual(1, results[1].index);
    Assert.areEqual(1, [SELECT COUNT() FROM Contact]);
  }

  @IsTest
  static void validateOnlyRollsBack() {
    List<SFI_ImportService.RowResult> results = run(
      'insert',
      null,
      new List<Map<String, String>>{
        new Map<String, String>{ 'LastName' => 'SFI Dry' }
      },
      true
    );
    Assert.isTrue(results[0].success, '' + results[0].error);
    Assert.areEqual(0, [SELECT COUNT() FROM Contact]);
  }

  @IsTest
  static void updateSkipsEmptyValuesAndRequiresId() {
    Contact contact = new Contact(LastName = 'SFI Update', Title = 'Keep me');
    insert contact;
    List<SFI_ImportService.RowResult> results = run(
      'update',
      null,
      new List<Map<String, String>>{
        new Map<String, String>{
          'Id' => contact.Id,
          'LastName' => 'SFI Updated',
          'Title' => ''
        },
        new Map<String, String>{ 'Id' => '', 'LastName' => 'No Id' }
      },
      false
    );
    Assert.isTrue(results[0].success, '' + results[0].error);
    Assert.isFalse(results[1].success);
    Contact updated = [
      SELECT LastName, Title
      FROM Contact
      WHERE Id = :contact.Id
    ];
    Assert.areEqual('SFI Updated', updated.LastName);
    Assert.areEqual('Keep me', updated.Title);
  }

  @IsTest
  static void upsertAndDelete() {
    Contact contact = new Contact(LastName = 'SFI Upsert');
    insert contact;
    List<SFI_ImportService.RowResult> upserted = run(
      'upsert',
      'Id',
      new List<Map<String, String>>{
        new Map<String, String>{
          'Id' => contact.Id,
          'LastName' => 'SFI Upserted'
        }
      },
      false
    );
    Assert.isTrue(upserted[0].success, '' + upserted[0].error);
    Assert.isFalse(upserted[0].created);

    List<SFI_ImportService.RowResult> deleted = run(
      'delete',
      null,
      new List<Map<String, String>>{
        new Map<String, String>{ 'Id' => contact.Id },
        new Map<String, String>{ 'Id' => 'bad' }
      },
      false
    );
    Assert.isTrue(deleted[0].success, '' + deleted[0].error);
    Assert.isFalse(deleted[1].success);
    Assert.areEqual(0, [SELECT COUNT() FROM Contact]);
  }

  @IsTest
  static void rejectsUnknownOperation() {
    try {
      run('merge', null, new List<Map<String, String>>(), false);
      Assert.fail('An exception was expected');
    } catch (AuraHandledException e) {
      Assert.isTrue(e.getMessage().contains('Unsupported'), e.getMessage());
    }
  }

  @IsTest
  static void getImportFieldsFlagsRequiredFields() {
    Boolean lastNameRequired = false;
    for (
      SFI_ImportService.ImportField field : SFI_ImportService.getImportFields(
        'Contact'
      )
    ) {
      if (field.name == 'LastName') {
        lastNameRequired = field.requiredOnCreate;
      }
    }
    Assert.isTrue(lastNameRequired);
  }

  @IsTest
  static void convertHandlesTypes() {
    Assert.areEqual(
      true,
      SFI_ImportService.convert('yes', Contact.DoNotCall.getDescribe())
    );
    Assert.areEqual(
      Date.newInstance(1990, 5, 17),
      SFI_ImportService.convert('1990-05-17', Contact.Birthdate.getDescribe())
    );
  }
}
