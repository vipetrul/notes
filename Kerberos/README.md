# Kerberos commands

Display keytab info:<br>
`ktpass /in <keytab file>`

## Generate keytab

With password prompt:<br>
`ktpass /princ username@CONTOSO.COM -SetUPN /crypto AES256-SHA1 /ptype KRB5_NT_PRINCIPAL /out username.keytab /pass * -SetPass`

Without password prompt:<br>
`ktpass /princ username@CONTOSO.COM -SetUPN /crypto AES256-SHA1 /ptype KRB5_NT_PRINCIPAL /out username.keytab /pass <password> -SetPass`

**Note:** Principal name should exactly match `UserPrincipalName` value from AD. To get exact value run powershell command `Get-AdUser <username>`
