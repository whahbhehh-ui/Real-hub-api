--[[ REAL HUB key loader
  1) Set SERVER below to your hosted key server (no trailing slash).
  2) Give players this file's contents as the loadstring/loader.
  Flow:
   - First run: asks for a key, sends it with the machine HWID (server locks the key to that HWID),
     saves a key file in the executor workspace, then runs the hub.
   - Next runs: key file is checked silently -> no typing needed (only works on the same HWID).
   - Admin resets the key / key expires / key is invalid -> file is deleted, key is asked again.
]]

local SERVER = "https://YOUR-SERVER.example.com"
local FILE = "RealHub_Key.json"

local HttpService = game:GetService("HttpService")
local TweenService = game:GetService("TweenService")
local requestFn = (syn and syn.request) or (http and http.request) or http_request or request or (fluxus and fluxus.request)

local MSG = {
	invalid = "Invalid key",
	expired = "Key expired - enter a new key",
	locked = "This key is already used on another device. Ask admin to reset it",
	nohwid = "Could not read your HWID",
	reset = "Your key was reset - enter it again",
	rate = "Too many tries - wait a minute",
}

-- ===== key file =====
local function readSaved()
	if not (isfile and readfile) then return nil end
	local ok, exists = pcall(isfile, FILE)
	if not ok or not exists then return nil end
	local ok2, raw = pcall(readfile, FILE)
	if not ok2 then return nil end
	local ok3, data = pcall(HttpService.JSONDecode, HttpService, raw)
	if ok3 and type(data) == "table" and data.key and data.token then return data end
	return nil
end

local function saveFile(key, token)
	if writefile then
		pcall(writefile, FILE, HttpService:JSONEncode({ key = key, token = token }))
	end
end

local function removeFile()
	if isfile and isfile(FILE) then
		if delfile then pcall(delfile, FILE) elseif writefile then pcall(writefile, FILE, "") end
	end
end

-- ===== HWID =====
local function getHwid()
	local id
	pcall(function() if gethwid then id = gethwid() end end)
	if not id then pcall(function() if get_hwid then id = get_hwid() end end) end
	if not id then pcall(function() id = game:GetService("RbxAnalyticsService"):GetClientId() end) end
	if id == nil or tostring(id) == "" then return nil end
	return tostring(id)
end

-- ===== server call =====
local function verify(key, token)
	if not requestFn then return nil, "Executor has no HTTP request function" end
	local hwid = getHwid()
	if not hwid then return nil, MSG.nohwid end
	local ok, res = pcall(requestFn, {
		Url = SERVER .. "/api/verify",
		Method = "POST",
		Headers = { ["Content-Type"] = "application/json" },
		Body = HttpService:JSONEncode({ key = key, token = token, hwid = hwid }),
	})
	if not ok or type(res) ~= "table" then return nil, "Cannot reach key server" end
	local ok2, data = pcall(HttpService.JSONDecode, HttpService, res.Body or "")
	if not ok2 or type(data) ~= "table" then return nil, "Bad response from server" end
	return data
end

local function runHub(src)
	local fn, err = loadstring(src)
	if not fn then warn("[REAL HUB] script error: " .. tostring(err)) return end
	task.spawn(function()
		local ok, e = pcall(fn)
		if not ok then warn("[REAL HUB] runtime error: " .. tostring(e)) end
	end)
end

-- ===== GUI =====
local function make(class, props, parent)
	local o = Instance.new(class)
	for k, v in pairs(props) do o[k] = v end
	o.Parent = parent
	return o
end

local function showGui(firstMsg)
	local gui = Instance.new("ScreenGui")
	gui.Name = "RealHubKey"
	gui.ResetOnSpawn = false
	gui.DisplayOrder = 999
	pcall(function() if syn and syn.protect_gui then syn.protect_gui(gui) end end)
	gui.Parent = (gethui and gethui()) or game:GetService("CoreGui")

	local frame = make("Frame", {
		Size = UDim2.fromOffset(340, 210), Position = UDim2.new(0.5, -170, 0.5, -105),
		BackgroundColor3 = Color3.fromRGB(14, 8, 9), BorderSizePixel = 0, Active = true, Draggable = true,
	}, gui)
	make("UICorner", { CornerRadius = UDim.new(0, 10) }, frame)
	make("UIStroke", { Color = Color3.fromRGB(212, 20, 30), Thickness = 1.6 }, frame)

	make("TextLabel", {
		Size = UDim2.new(1, 0, 0, 44), BackgroundTransparency = 1, Text = "REAL HUB",
		Font = Enum.Font.GothamBlack, TextSize = 24, TextColor3 = Color3.fromRGB(255, 42, 54),
	}, frame)
	make("TextLabel", {
		Size = UDim2.new(1, 0, 0, 18), Position = UDim2.fromOffset(0, 40), BackgroundTransparency = 1,
		Text = "Enter your key", Font = Enum.Font.Gotham, TextSize = 13, TextColor3 = Color3.fromRGB(166, 151, 141),
	}, frame)

	local box = make("TextBox", {
		Size = UDim2.new(1, -40, 0, 38), Position = UDim2.fromOffset(20, 70), BackgroundColor3 = Color3.fromRGB(28, 18, 20),
		Text = "", PlaceholderText = "XXXX-XXXX-XXXX-XXXX", PlaceholderColor3 = Color3.fromRGB(110, 95, 90),
		TextColor3 = Color3.fromRGB(240, 232, 226), Font = Enum.Font.Code, TextSize = 16, ClearTextOnFocus = false,
	}, frame)
	make("UICorner", { CornerRadius = UDim.new(0, 6) }, box)
	make("UIStroke", { Color = Color3.fromRGB(90, 60, 62), Thickness = 1 }, box)

	local status = make("TextLabel", {
		Size = UDim2.new(1, -40, 0, 32), Position = UDim2.fromOffset(20, 114), BackgroundTransparency = 1,
		Text = firstMsg or "", Font = Enum.Font.Gotham, TextSize = 13, TextWrapped = true,
		TextColor3 = Color3.fromRGB(255, 107, 102),
	}, frame)

	local btn = make("TextButton", {
		Size = UDim2.new(1, -40, 0, 38), Position = UDim2.fromOffset(20, 156), BackgroundColor3 = Color3.fromRGB(212, 20, 30),
		Text = "Verify key", Font = Enum.Font.GothamBold, TextSize = 16, TextColor3 = Color3.new(1, 1, 1), AutoButtonColor = true,
	}, frame)
	make("UICorner", { CornerRadius = UDim.new(0, 6) }, btn)

	local busy = false
	local function submit()
		if busy then return end
		local key = string.upper((box.Text:gsub("%s+", "")))
		if key == "" then status.Text = "Enter a key first" return end
		busy = true
		status.TextColor3 = Color3.fromRGB(200, 205, 214)
		status.Text = "Checking..."
		local data, err = verify(key, nil)
		if not data then
			status.TextColor3 = Color3.fromRGB(255, 107, 102)
			status.Text = err
		elseif data.ok then
			saveFile(key, data.token)
			status.TextColor3 = Color3.fromRGB(159, 207, 134)
			status.Text = "Key accepted"
			task.wait(0.5)
			gui:Destroy()
			runHub(data.script)
			return
		else
			status.TextColor3 = Color3.fromRGB(255, 107, 102)
			status.Text = MSG[data.code] or "Key rejected"
		end
		busy = false
	end
	btn.MouseButton1Click:Connect(submit)
	box.FocusLost:Connect(function(enter) if enter then submit() end end)
end

-- ===== main =====
local saved = readSaved()
if saved then
	local data, err = verify(saved.key, saved.token)
	if not data then
		showGui(err) -- server unreachable: keep the file, let the player retry
	elseif data.ok then
		runHub(data.script) -- already activated on this IP: bypass the key box
	else
		removeFile() -- reset / expired / invalid: file is deleted, ask for key again
		showGui(MSG[data.code])
	end
else
	showGui()
end
