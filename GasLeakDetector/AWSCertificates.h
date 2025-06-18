#ifndef AWS_CERTIFICATES_H
#define AWS_CERTIFICATES_H

#include <pgmspace.h>

class AWSCertificates {
  private:
    static const char AMAZON_ROOT_CA1[] PROGMEM;
    static const char DEVICE_CERTIFICATE[] PROGMEM;
    static const char DEVICE_PRIVATE_KEY[] PROGMEM;

  public:
    static const char* getRootCA();
    static const char* getDeviceCertificate();
    static const char* getPrivateKey();
};

#endif