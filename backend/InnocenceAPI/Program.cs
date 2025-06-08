
using Microsoft.EntityFrameworkCore;
using InnocenceAPI.Data;
using InnocenceAPI.Services;
using InnocenceAPI.Models;

namespace InnocenceAPI;

public class Program
{
    public static void Main(string[] args)
    {
        var builder = WebApplication.CreateBuilder(args);

        // Add services to the container.
        builder.Services.AddControllers();
        
        // Configure authorization (allow anonymous in development)
        builder.Services.AddAuthorization(options =>
        {
            if (builder.Environment.IsDevelopment())
            {
                options.FallbackPolicy = null; // No auth required in development
            }
        });
        
        builder.Services.AddOpenApi();

        // Add Entity Framework with In-Memory Database
        builder.Services.AddDbContext<ComplianceContext>(options =>
            options.UseInMemoryDatabase("ComplianceDb"));

        // Add HttpClient for external API calls
        builder.Services.AddHttpClient<IHyperCoreIntegrationService, HyperCoreIntegrationService>();

        // Configure options
        builder.Services.Configure<TokenConfiguration>(
            builder.Configuration.GetSection("Tokens"));
        builder.Services.Configure<NetworkConfiguration>(
            builder.Configuration.GetSection("Network"));

        // Add application services
        builder.Services.AddScoped<IComplianceService, ComplianceService>();
        builder.Services.AddScoped<IHyperCoreIntegrationService, HyperCoreIntegrationService>();
        builder.Services.AddScoped<ITokenService, TokenService>();

        // Add CORS for frontend
        builder.Services.AddCors(options =>
        {
            options.AddDefaultPolicy(policy =>
            {
                policy.AllowAnyOrigin()
                      .AllowAnyMethod()
                      .AllowAnyHeader();
            });
        });

        var app = builder.Build();

        // Configure the HTTP request pipeline.
        if (app.Environment.IsDevelopment())
        {
            app.MapOpenApi();
        }

        app.UseCors();
        
        // Map controllers before authorization to ensure proper routing
        app.MapControllers();
        
        app.UseAuthorization();

        // Seed initial data (for demo purposes)
        using (var scope = app.Services.CreateScope())
        {
            var context = scope.ServiceProvider.GetRequiredService<ComplianceContext>();
            
            // Add some example sanctioned addresses
            if (!context.SanctionEntries.Any())
            {
                context.SanctionEntries.AddRange(
                    new SanctionEntry 
                    { 
                        Address = "0x7F367cC41522cE07553e823bf3be79A889DEbe1B",
                        Source = "OFAC",
                        AddedDate = DateTime.UtcNow,
                        Reason = "Tornado Cash"
                    },
                    new SanctionEntry 
                    { 
                        Address = "0xd90e2f925DA726b50C4Ed8D0Fb90Ad053324F31b",
                        Source = "OFAC",
                        AddedDate = DateTime.UtcNow,
                        Reason = "Tornado Cash Router"
                    }
                );
                context.SaveChanges();
            }
        }

        app.Run();
    }
}
