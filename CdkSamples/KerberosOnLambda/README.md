# Kerberos on Lambda

## Deployment

1. Update `bin/cdk.ts` to specify your AWS account and region.
2. Deploy all stacks using `cdk deploy --all` .
3. RDP into EC2 DirectoryManagementInstance and join it the domain.
4. Create new AD user `db-user` .
5. Create new SQL database `myDb` and grant `db-user` permissions to coonect and use database.
6. Create a KeyTab for `db-user` (see instructions below), and save Base64 encoded KeyTab to `/kerberos-on-lambda/KerberosSettings/KeyTabBase64` SSM Parameter.

## Connection string

When using Kerberos with SQL Server, it is very import to use proper SQL Server hostname in connection string. This is because Kerberos is tightly coupled with Service Provider Name (SPN). To see all SPN's used by SQL Servers on your domain, run this command:<br>
`setspn -T YOUR-DOMAIN.COM -F -Q MSSQLSvc/*`<br>

Example:<br>
`setspn -T DIRECTORY.KERBEROS-ON-LAMBDA-SAMPLE.COM -F -Q MSSQLSvc/*`

It is possible that more than one host name for the same server is suitable to be used with Kerberos. Although the default RDS Endpoint address is note one of them!!!

## Create KeyTab file

Create keytab file manually:<br>
`ktpass /princ db-user@DIRECTORY.KERBEROS-ON-LAMBDA-SAMPLE.COM -SetUPN /crypto AES256-SHA1 /ptype KRB5_NT_PRINCIPAL /out db-user.keytab /pass * -SetPass`

Convert KeyTab file to Base64 before saving to SSM parameter `/kerberos-on-lambda/KerberosSettings/KeyTabBase64`<br>
`[convert]::ToBase64String((Get-Content -path "db-user.keytab" -Encoding byte))`

**Note**: Key tab needs to be updated every time there are changes to user password, even if the same password was set again. This is because password version number (i.e. `msDS-KeyVersionNumber`) is also embedded into KeyTab file.
