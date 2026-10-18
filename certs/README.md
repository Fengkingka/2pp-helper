# HTTPS trust bundle

`cacert.pem` is the public Mozilla CA bundle distributed by curl, downloaded on 3 October 2026. It contains public root certificates, not API keys or private certificates.

Source and updates: https://curl.se/docs/caextract.html

The source certificate data is distributed under the Mozilla Public License 2.0: https://www.mozilla.org/en-US/MPL/2.0/

The optional `LLM_CA_FILE=certs/cacert.pem` setting supports portable PHP installations without a configured CA store. Certificate verification remains enabled.
