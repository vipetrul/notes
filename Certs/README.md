# Install CA

## Ubuntu

Cert files must have `*.crt` extension.
copy certs to `/usr/local/share/ca-certificates/`

`sudo update-ca-certificates`

## CentOS

Cert files must have `*.pem` extension.
copy certs to `/etc/pki/ca-trust/source/anchors/`

`sudo update-ca-trust`

# Check TLS connection

`curl -I -v --tlsv1.2 --tls-max 1.2 https://google.com`
`openssl s_client -connect google.com:443`

# PFX to PEM

## Single file export

`openssl pkcs12 -in cert.pfx -out cert.pem -nodes`

## Extracts the private key form a PFX to a PEM file:

`openssl pkcs12 -in cert.pfx -nocerts -out key.pem`

## Exports the certificate (includes the public key only):

`openssl pkcs12 -in cert.pfx -clcerts -nokeys -out cert.pem`

## Removes the password (paraphrase) from the extracted private key:

`openssl rsa -in key.pem -out server.key`

# Adding cert to HTTP Client in DOTNET

```
...
var cert = X509Certificate2.CreateFromPem(certPemTxt, certKeyTxt);
var clientCertificate = new X509Certificate2(cert.Export(X509ContentType.Pfx));
handler.ClientCertificates.Add(clientCertificate);
...

```
