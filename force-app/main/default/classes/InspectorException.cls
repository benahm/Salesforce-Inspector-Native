/**
 * Functional error raised by SF Inspector Native services.
 */
public with sharing class InspectorException extends Exception {
  /**
   * Wraps any exception into an AuraHandledException whose message reaches the LWC.
   */
  public static AuraHandledException toAura(Exception e) {
    String message = e.getMessage();
    AuraHandledException auraException = new AuraHandledException(message);
    auraException.setMessage(message);
    return auraException;
  }
}
