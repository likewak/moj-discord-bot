import discord
from discord.ext import commands
from discord.ui import Button, View
import os

# Definicje Intents i Bota (bez zmian)
intents = discord.Intents.default()
intents.message_content = True
intents.members = True
bot = commands.Bot(command_prefix='!', intents=intents)

# --- NOWOŚĆ: Klasa z naszym przyciskiem weryfikacyjnym ---
class VerificationView(View):
    def __init__(self):
        # Ustawiamy timeout=None, aby przyciski działały nawet po restarcie bota
        super().__init__(timeout=None) 

    @discord.ui.button(label="✅ Zweryfikuj!", style=discord.ButtonStyle.green, custom_id="verification_button")
    async def verify_button_callback(self, interaction: discord.Interaction, button: Button):
        # 1. Znajdź rolę "Zweryfikowany" na serwerze
        role = discord.utils.get(interaction.guild.roles, name="Zweryfikowany")
        
        if role is None:
            # Jeśli rola nie istnieje, poinformuj admina
            await interaction.response.send_message("Błąd: Rola 'Zweryfikowany' nie została znaleziona. Skontaktuj się z administratorem.", ephemeral=True)
            return

        # 2. Sprawdź, czy użytkownik już ma tę rolę
        if role in interaction.user.roles:
            await interaction.response.send_message("Już jesteś zweryfikowany!", ephemeral=True)
        else:
            # 3. Dodaj rolę użytkownikowi
            await interaction.user.add_roles(role)
            # 4. Wyślij potwierdzenie widoczne tylko dla tego użytkownika
            await interaction.response.send_message("Gratulacje! Zostałeś pomyślnie zweryfikowany i masz teraz dostęp do reszty serwera.", ephemeral=True)

# --- ZDARZENIA ---
@bot.event
async def on_ready():
    print(f'Zalogowano jako {bot.user.name}')
    # Rejestrujemy nasz widok z przyciskiem, aby działał po restarcie
    bot.add_view(VerificationView()) 
    print('Bot jest gotowy i system weryfikacji jest aktywny.')
    print('------')
    await bot.change_presence(activity=discord.Game(name="!pomoc"))

# --- KOMENDY ---

# Komendy !ping i !powiedz zostają bez zmian
@bot.command()
async def ping(ctx):
    opoznienie = round(bot.latency * 1000)
    await ctx.send(f'Pong! 🏓 Moje opóźnienie wynosi {opoznienie}ms.')

@bot.command()
async def powiedz(ctx, *, wiadomosc: str):
    await ctx.send(wiadomosc)
    await ctx.message.delete()

# --- NOWA KOMENDA: Tworzenie panelu weryfikacyjnego ---
@bot.command()
@commands.has_permissions(administrator=True) # Tylko admin może użyć tej komendy
async def stworz_weryfikacje(ctx):
    """Tworzy wiadomość z przyciskiem do weryfikacji."""
    embed = discord.Embed(
        title="Weryfikacja na serwerze",
        description="Witaj na naszym serwerze!\n\nAby uzyskać dostęp do wszystkich kanałów, kliknij przycisk poniżej.",
        color=discord.Color.gold()
    )
    # Usuwamy wiadomość z komendą
    await ctx.message.delete()
    # Wysyłamy wiadomość z embedem oraz naszym widokiem zawierającym przycisk
    await ctx.send(embed=embed, view=VerificationView())

@stworz_weryfikacje.error
async def weryfikacja_error(ctx, error):
    if isinstance(error, commands.MissingPermissions):
        await ctx.send("Nie masz uprawnień do użycia tej komendy!", delete_after=10)
        await ctx.message.delete()


# Komenda !pomoc (teraz z nową komendą)
bot.remove_command('help')
@bot.command()
async def pomoc(ctx):
    embed = discord.Embed(title="Pomoc Bota", color=discord.Color.blue())
    embed.add_field(name="!ping", value="Sprawdza opóźnienie bota.", inline=False)
    embed.add_field(name="!powiedz <wiadomość>", value="Bot powtarza Twoją wiadomość.", inline=False)
    embed.add_field(name="!stworz_weryfikacje", value="[Admin] Tworzy panel weryfikacyjny.", inline=False)
    await ctx.send(embed=embed)

# Uruchomienie bota (bez zmian)
TOKEN = os.getenv("DISCORD_TOKEN")
if TOKEN is None:
    print("BŁĄD: Nie znaleziono tokenu!")
else:
    bot.run(TOKEN)
    # Wklej na samym końcu pliku
# To jest testowa zmiana, aby wymusić aktualizację