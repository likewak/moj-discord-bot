# Importujemy potrzebne biblioteki (teraz też 'os')
import discord
from discord.ext import commands
import os # Ta biblioteka pozwoli nam czytać ukryte zmienne

# === TOKEN BĘDZIE WCZYTYWANY Z SERWERA, A NIE WPISANY TUTAJ ===
# TOKEN = 'TUTAJ_WKLEJ_SWÓJ_TOKEN'  <-- TEJ LINII JUŻ NIE MA

# Definiujemy "Intents", czyli uprawnienia, o które prosimy Discorda
intents = discord.Intents.default()
intents.message_content = True
intents.members = True

# Tworzymy obiekt bota, podając prefix komendy (znak '!') oraz nasze intencje
bot = commands.Bot(command_prefix='!', intents=intents)

# === ZDARZENIA ===

@bot.event
async def on_ready():
    print(f'Zalogowano jako {bot.user.name} (ID: {bot.user.id})')
    print('Bot jest gotowy do przyjmowania komend.')
    print('------')
    await bot.change_presence(activity=discord.Game(name="!pomoc"))

# === KOMENDY (zostają bez zmian) ===

@bot.command()
async def ping(ctx):
    """Odpowiada 'Pong!' i pokazuje opóźnienie bota."""
    opoznienie = round(bot.latency * 1000)
    await ctx.send(f'Pong! 🏓 Moje opóźnienie wynosi {opoznienie}ms.')

@bot.command()
async def powiedz(ctx, *, wiadomosc: str):
    """Bot powtarza podaną przez użytkownika wiadomość."""
    await ctx.send(wiadomosc)
    await ctx.message.delete()

bot.remove_command('help')

@bot.command()
async def pomoc(ctx):
    """Wyświetla tę wiadomość pomocy."""
    embed = discord.Embed(
        title="Pomoc Bota",
        description="Oto lista dostępnych komend:",
        color=discord.Color.blue()
    )
    embed.add_field(name="!ping", value="Sprawdza opóźnienie bota.", inline=False)
    embed.add_field(name="!powiedz <wiadomość>", value="Bot powtarza Twoją wiadomość.", inline=False)
    embed.add_field(name="!pomoc", value="Wyświetla tę listę komend.", inline=False)
    embed.set_footer(text=f"Bot stworzony dla Ciebie przez Ciebie!")

    await ctx.send(embed=embed)

# Na sam koniec, uruchamiamy bota, wczytując token z bezpiecznego miejsca
# os.getenv("NAZWA_ZMIENNEJ") czyta zmienną, którą ustawimy na serwerze Render
TOKEN = os.getenv("DISCORD_TOKEN")
if TOKEN is None:
    print("BŁĄD: Nie znaleziono tokenu w zmiennych środowiskowych!")
else:
    bot.run(TOKEN)