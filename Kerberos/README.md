# Kerberos commands

Display keytab info:<br>
`ktpass /in <keytab file>`

## Generate keytab

With password prompt:<br>
`ktpass /princ username@CONTOSO.COM -SetUPN /crypto AES256-SHA1 /ptype KRB5_NT_PRINCIPAL /out username.keytab /pass * -SetPass`

Without password prompt:<br>
`ktpass /princ username@CONTOSO.COM -SetUPN /crypto AES256-SHA1 /ptype KRB5_NT_PRINCIPAL /out username.keytab /pass <password> -SetPass`

**Note:** Principal name should exactly match `UserPrincipalName` value from AD. To get exact value run powershell command `Get-AdUser <username>`

## Ticket commands

The `klist` command shows your tickets.

The `kdestroy` command will remove all tickets.

Acquire forwardable TGT ticket :

`kinit -f -V username@CONTOSO.COM`

Acquire service ticket (for a SQL Server as an example):

`kvno MSSQLSvc/my-sql-instance.contoso.com`

## Troubleshooting

Set env variable `KRB5_TRACE` to a file location where logs should be captured:

`export KRB5_TRACE=$HOME/kerb.log`
