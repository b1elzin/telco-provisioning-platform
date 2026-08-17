# Security and public portfolio policy

This is a clean-room project. Contributions must not include material copied from an employer or client.

Never commit:

- credentials, tokens, certificates, API keys or populated `.env` files;
- real subscriber identifiers, phone numbers, IMSIs, ICCIDs or customer records;
- internal hostnames, IP addresses, account IDs, queue names or cloud resource IDs;
- proprietary provider payloads, schemas, documents or commercial terms;
- production logs, screenshots, tickets, repository history or company-specific source code.

Use fictional providers (`provider-alpha`, `provider-beta`, `ims-provider`), reserved example identifiers and generated datasets. Before publication, scan the full Git history as well as the working tree.

To report a problem, open a private GitHub security advisory rather than a public issue.
