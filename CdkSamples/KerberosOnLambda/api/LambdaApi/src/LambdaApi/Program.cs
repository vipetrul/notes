using LambdaApi.Database;
using Microsoft.EntityFrameworkCore;
using LambdaApi;
using Zyborg.AWS.Lambda.Kerberos;

var builder = WebApplication.CreateBuilder(args);

//Use AWS SSM Parameter Store as one of the sources for parameters
builder.Configuration.AddSystemsManager(Environment.GetEnvironmentVariable("SsmParametersPrefix") ?? "/");

var kerberosSettings = builder.Configuration
    .GetSection(nameof(KerberosSettings))
    .Get<KerberosSettings>() ?? new KerberosSettings();

Console.WriteLine(kerberosSettings);


// Add services to the container.
builder.Services.AddControllers();

builder.Services.AddSwaggerGen();

// Add AWS Lambda support. When application is run in Lambda Kestrel is swapped out as the web server with Amazon.Lambda.AspNetCoreServer. This
// package will act as the webserver translating request and responses between the Lambda event source and ASP.NET Core.
builder.Services.AddAWSLambdaHosting(LambdaEventSource.HttpApi);

builder.Services.AddDbContext<MyDbContext>(options =>
    options.UseSqlServer(builder.Configuration.GetConnectionString("MyDb")));

//Register Kerberos Services
if (kerberosSettings.Enabled)
{
    builder.Services.AddSingleton<KerberosManager>(svc =>
    {
        var km = new KerberosManager(new KerberosOptions()
        {
            Logger = svc.GetService<ILogger<KerberosManager>>(),
            RealmKdc = kerberosSettings.RealmKdc,
            Realm = kerberosSettings.Realm,
            Principal = kerberosSettings.Principal,
            
        });

        using var keyTabStream = kerberosSettings.GetKeyTabStream();
        
        km.Init(keyTabStream);
        km.Refresh();

        return km;
    });
}


var app = builder.Build();

app.UseHttpsRedirection();
app.UseAuthorization();
app.MapControllers();

app.UseSwagger();
app.UseSwaggerUI();

if (kerberosSettings.Enabled)
{
    // Create middleware that attempts to refresh kerberos ticket if they about to expire
    app.Use(async (context, next) =>
    {
        var km = context.RequestServices.GetRequiredService<KerberosManager>();
        km.Refresh();

        await next(context);
    });
}

app.MapGet("/", () => "Welcome to running ASP.NET Core Minimal API on AWS Lambda");

app.Run();
