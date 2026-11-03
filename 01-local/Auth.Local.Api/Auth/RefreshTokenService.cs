
using System.Security.Cryptography;
using Auth.Local.Api.Data;
using Auth.Local.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace Auth.Local.Api.Auth;

public class RefreshTokenService(AppDbContext db)
{
    public static string HashToken(string token)
    {
        var bytes = SHA256.HashData(
            System.Text.Encoding.UTF8.GetBytes(token));

        return Convert.ToHexString(bytes);
    }

    private static string GenerateToken()
    {
        var bytes = RandomNumberGenerator.GetBytes(32);

        return Convert.ToBase64String(bytes)
            .Replace("+", "-")
            .Replace("/", "_")
            .TrimEnd('=');
    }

    public async Task<string> CreateAsync(int userId)
    {
        var token = GenerateToken();

        var refreshToken = new RefreshToken
        {
            UserId = userId,
            TokenHash = HashToken(token),
            CreatedAt = DateTime.UtcNow,
            ExpiresAt = DateTime.UtcNow.AddDays(7)
        };

        db.RefreshTokens.Add(refreshToken);
        await db.SaveChangesAsync();

        return token;
    }

    public async Task<(int? UserId, string? NewToken)> RotateAsync(
        string token)
    {
        if (string.IsNullOrWhiteSpace(token))
            return (null, null);

        var tokenHash = HashToken(token);

        var storedToken = await db.RefreshTokens
            .FirstOrDefaultAsync(t => t.TokenHash == tokenHash);

        if (storedToken is null)
            return (null, null);

        // Si se reutiliza un token revocado, invalidamos
        // todos los refresh tokens activos del usuario.
        if (storedToken.RevokedAt is not null)
        {
            await db.RefreshTokens
                .Where(t => t.UserId == storedToken.UserId &&
                            t.RevokedAt == null)
                .ExecuteUpdateAsync(setters => setters
                    .SetProperty(t => t.RevokedAt, DateTime.UtcNow));

            return (null, null);
        }

        if (storedToken.ExpiresAt <= DateTime.UtcNow)
            return (null, null);

        var newToken = GenerateToken();

        var replacement = new RefreshToken
        {
            UserId = storedToken.UserId,
            TokenHash = HashToken(newToken),
            CreatedAt = DateTime.UtcNow,
            ExpiresAt = DateTime.UtcNow.AddDays(7)
        };

        db.RefreshTokens.Add(replacement);
        await db.SaveChangesAsync();

        storedToken.RevokedAt = DateTime.UtcNow;
        storedToken.ReplacedByTokenId = replacement.Id;

        await db.SaveChangesAsync();

        return (storedToken.UserId, newToken);
    }

    public async Task<bool> RevokeAsync(string token)
    {
        if (string.IsNullOrWhiteSpace(token))
            return false;

        var tokenHash = HashToken(token);

        var storedToken = await db.RefreshTokens
            .FirstOrDefaultAsync(t => t.TokenHash == tokenHash);

        if (storedToken is null || storedToken.RevokedAt is not null)
            return false;

        storedToken.RevokedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();

        return true;
    }
}
