using System.Runtime.CompilerServices;
using System.Text.Json;

namespace LambdaApi;

public class KerberosSettings
{
    public bool Enabled { get; set; }
    public string KeyTabBase64 { get; set; } = "";
    public string RealmKdc { get; set; } = "";
    public string Realm => this.RealmKdc.ToUpper();
    public string Username { get; set; } = "";
    public string Principal => $"{Username}@{Realm}";


    public Stream GetKeyTabStream()
    {
        var keyTab = Convert.FromBase64String(this.KeyTabBase64);
        return new MemoryStream(keyTab);
    }

    public override string ToString()
    {
        return JsonSerializer.Serialize(this, new JsonSerializerOptions()
        {
            WriteIndented = true
        });
    }
}