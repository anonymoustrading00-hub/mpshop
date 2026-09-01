// Catálogos globales y base de datos de laptops para autocompletado inteligente

export const DEFAULT_DEVICE_BRANDS: string[] = [
  "Acer",
  "Apple",
  "Asus",
  "Avita",
  "Chuwi",
  "Dell",
  "Fujitsu",
  "Gigabyte",
  "HP",
  "Honor",
  "Huawei",
  "Infinix",
  "LG",
  "Lenovo",
  "MSI",
  "Microsoft",
  "Primebook",
  "Realme",
  "Samsung",
  "Tecno",
  "Toshiba",
  "Ultimus",
  "Wings",
  "Xiaomi",
  "iBall"
];

export interface DeviceModelDefault {
  brand: string;
  name: string;
  fullName?: string;
  defaultSpecs: Record<string, string>;
}

export const DEFAULT_DEVICE_MODELS: DeviceModelDefault[] = [
  {
    "brand": "Tecno",
    "name": "Megabook T1 Laptop",
    "fullName": "Tecno Megabook T1 Laptop",
    "defaultSpecs": {
      "cpu": "11th Gen Core i3",
      "ram": "8GB",
      "storage": "512GB SSD",
      "screenSize": "15.6\"",
      "gpu": "Intel Iris Xe / UHD Graphics",
      "resolution": "1920x1080 (FHD)",
      "os": "Windows 11"
    }
  },
  {
    "brand": "HP",
    "name": "Victus 15-fb0157AX Gaming Laptop",
    "fullName": "HP Victus 15-fb0157AX Gaming Laptop",
    "defaultSpecs": {
      "cpu": "AMD Ryzen 5 5600H",
      "ram": "8GB",
      "storage": "512GB SSD",
      "screenSize": "15.6\"",
      "gpu": "AMD Radeon Dedicated",
      "resolution": "1920x1080 (FHD)",
      "os": "Windows 11"
    }
  },
  {
    "brand": "Acer",
    "name": "Extensa EX214-53 Laptop",
    "fullName": "Acer Extensa EX214-53 Laptop",
    "defaultSpecs": {
      "cpu": "12th Gen Core i5",
      "ram": "8GB",
      "storage": "512GB SSD",
      "screenSize": "14.0\"",
      "gpu": "Intel Iris Xe / UHD Graphics",
      "resolution": "1920x1080 (FHD)",
      "os": "Windows 11"
    }
  },
  {
    "brand": "Lenovo",
    "name": "V15 82KDA01BIH Laptop",
    "fullName": "Lenovo V15 82KDA01BIH Laptop",
    "defaultSpecs": {
      "cpu": "AMD Ryzen 3 5300U",
      "ram": "8GB",
      "storage": "512GB SSD",
      "screenSize": "15.6\"",
      "gpu": "Intel Iris Xe / UHD Graphics",
      "resolution": "1920x1080 (FHD)",
      "os": "Windows 11"
    }
  },
  {
    "brand": "Apple",
    "name": "MacBook Air 2020 MGND3HN Laptop",
    "fullName": "Apple MacBook Air 2020 MGND3HN Laptop",
    "defaultSpecs": {
      "cpu": "Apple M1",
      "ram": "8GB",
      "storage": "256GB SSD",
      "screenSize": "13.3\"",
      "gpu": "Apple M-Series GPU",
      "resolution": "1920x1080 (FHD)",
      "os": "macOS"
    }
  },
  {
    "brand": "Infinix",
    "name": "INBook Y2 Plus Laptop",
    "fullName": "Infinix INBook Y2 Plus Laptop",
    "defaultSpecs": {
      "cpu": "11th Gen Core i5",
      "ram": "16GB",
      "storage": "512GB SSD",
      "screenSize": "15.6\"",
      "gpu": "Intel Iris Xe / UHD Graphics",
      "resolution": "1920x1080 (FHD)",
      "os": "Windows 11"
    }
  },
  {
    "brand": "Asus",
    "name": "TUF Gaming F15 FX506HF-HN024W Gaming Laptop",
    "fullName": "Asus TUF Gaming F15 FX506HF-HN024W Gaming Laptop",
    "defaultSpecs": {
      "cpu": "11th Gen Core i5",
      "ram": "8GB",
      "storage": "512GB SSD",
      "screenSize": "15.6\"",
      "gpu": "NVIDIA GeForce Dedicated",
      "resolution": "1920x1080 (FHD)",
      "os": "Windows 11"
    }
  },
  {
    "brand": "HP",
    "name": "15s-fq5007TU Laptop",
    "fullName": "HP 15s-fq5007TU Laptop",
    "defaultSpecs": {
      "cpu": "12th Gen Core i3",
      "ram": "8GB",
      "storage": "512GB SSD",
      "screenSize": "15.6\"",
      "gpu": "Intel Iris Xe / UHD Graphics",
      "resolution": "1920x1080 (FHD)",
      "os": "Windows 11"
    }
  },
  {
    "brand": "Infinix",
    "name": "Zerobook 2023 Laptop",
    "fullName": "Infinix Zerobook 2023 Laptop",
    "defaultSpecs": {
      "cpu": "13th Gen Core i9",
      "ram": "32GB",
      "storage": "1TB SSD",
      "screenSize": "15.6\"",
      "gpu": "Intel Iris Xe / UHD Graphics",
      "resolution": "1920x1080 (FHD)",
      "os": "Windows 11"
    }
  },
  {
    "brand": "Dell",
    "name": "Inspiron 3520 D560896WIN9B Laptop",
    "fullName": "Dell Inspiron 3520 D560896WIN9B Laptop",
    "defaultSpecs": {
      "cpu": "12th Gen Core i3",
      "ram": "8GB",
      "storage": "512GB SSD",
      "screenSize": "15.6\"",
      "gpu": "Intel Iris Xe / UHD Graphics",
      "resolution": "1920x1080 (FHD)",
      "os": "Windows 11"
    }
  },
  {
    "brand": "Samsung",
    "name": "Galaxy Book2 Pro 13 Laptop",
    "fullName": "Samsung Galaxy Book2 Pro 13 Laptop",
    "defaultSpecs": {
      "cpu": "12th Gen Core i5",
      "ram": "16GB",
      "storage": "512GB SSD",
      "screenSize": "13.3\"",
      "gpu": "Intel Iris Xe / UHD Graphics",
      "resolution": "1920x1080 (FHD)",
      "os": "Windows 11"
    }
  },
  {
    "brand": "MSI",
    "name": "Thin GF63 12UC-846IN Gaming Laptop",
    "fullName": "MSI Thin GF63 12UC-846IN Gaming Laptop",
    "defaultSpecs": {
      "cpu": "12th Gen Core i5",
      "ram": "16GB",
      "storage": "512GB SSD",
      "screenSize": "15.6\"",
      "gpu": "NVIDIA GeForce Dedicated",
      "resolution": "1920x1080 (FHD)",
      "os": "Windows 11"
    }
  },
  {
    "brand": "Asus",
    "name": "Vivobook 16X 2022 M1603QA-MB711WS Laptop",
    "fullName": "Asus Vivobook 16X 2022 M1603QA-MB711WS Laptop",
    "defaultSpecs": {
      "cpu": "Ryzen 7-5800H",
      "ram": "16GB",
      "storage": "512GB SSD",
      "screenSize": "16.0\"",
      "gpu": "Intel Iris Xe / UHD Graphics",
      "resolution": "1920x1080 (FHD)",
      "os": "Windows 11"
    }
  },
  {
    "brand": "Lenovo",
    "name": "IdeaPad Slim 3 82H803LKIN Laptop",
    "fullName": "Lenovo IdeaPad Slim 3 82H803LKIN Laptop",
    "defaultSpecs": {
      "cpu": "11th Gen Core i5",
      "ram": "16GB",
      "storage": "512GB SSD",
      "screenSize": "15.6\"",
      "gpu": "Intel Iris Xe / UHD Graphics",
      "resolution": "1920x1080 (FHD)",
      "os": "Windows 11"
    }
  },
  {
    "brand": "HP",
    "name": "Omen 16-wf1025TX Gaming Laptop",
    "fullName": "HP Omen 16-wf1025TX Gaming Laptop",
    "defaultSpecs": {
      "cpu": "14th Gen Core i7",
      "ram": "16GB",
      "storage": "1TB SSD",
      "screenSize": "16.1\"",
      "gpu": "NVIDIA GeForce Dedicated",
      "resolution": "1920x1080 (FHD)",
      "os": "Windows 11"
    }
  },
  {
    "brand": "Lenovo",
    "name": "V15 G3 IAP 82TTA08AIN Laptop",
    "fullName": "Lenovo V15 G3 IAP 82TTA08AIN Laptop",
    "defaultSpecs": {
      "cpu": "12th Gen Core i7",
      "ram": "16GB",
      "storage": "512GB SSD",
      "screenSize": "15.6\"",
      "gpu": "Intel Iris Xe / UHD Graphics",
      "resolution": "1920x1080 (FHD)",
      "os": "Windows 11"
    }
  },
  {
    "brand": "Asus",
    "name": "TUF Gaming F15 FX506HE-HN385WS Gaming Laptop",
    "fullName": "Asus TUF Gaming F15 FX506HE-HN385WS Gaming Laptop",
    "defaultSpecs": {
      "cpu": "11th Gen Core i7",
      "ram": "16GB",
      "storage": "1TB SSD",
      "screenSize": "15.6\"",
      "gpu": "NVIDIA GeForce Dedicated",
      "resolution": "1920x1080 (FHD)",
      "os": "Windows 11"
    }
  },
  {
    "brand": "HP",
    "name": "Victus 15-fb1017AX Gaming Laptop",
    "fullName": "HP Victus 15-fb1017AX Gaming Laptop",
    "defaultSpecs": {
      "cpu": "AMD Ryzen 5 7535HS",
      "ram": "16GB",
      "storage": "512GB SSD",
      "screenSize": "15.6\"",
      "gpu": "NVIDIA GeForce Dedicated",
      "resolution": "1920x1080 (FHD)",
      "os": "Windows 11"
    }
  },
  {
    "brand": "Wings",
    "name": "Nuvobook V1 Laptop",
    "fullName": "Wings Nuvobook V1 Laptop",
    "defaultSpecs": {
      "cpu": "11th Gen Core i5",
      "ram": "8GB",
      "storage": "512GB SSD",
      "screenSize": "15.6\"",
      "gpu": "Intel Iris Xe / UHD Graphics",
      "resolution": "1920x1080 (FHD)",
      "os": "Windows 11"
    }
  },
  {
    "brand": "HP",
    "name": "255 G9 840T7PA Laptop",
    "fullName": "HP 255 G9 840T7PA Laptop",
    "defaultSpecs": {
      "cpu": "AMD Athlon Silver-3050U",
      "ram": "4GB",
      "storage": "256GB SSD",
      "screenSize": "15.6\"",
      "gpu": "Intel Iris Xe / UHD Graphics",
      "resolution": "1920x1080 (FHD)",
      "os": "Windows 11"
    }
  },
  {
    "brand": "Lenovo",
    "name": "V15 G4 82YU00W7IN Laptop",
    "fullName": "Lenovo V15 G4 82YU00W7IN Laptop",
    "defaultSpecs": {
      "cpu": "AMD Ryzen 3 7320U",
      "ram": "8GB",
      "storage": "512GB SSD",
      "screenSize": "15.6\"",
      "gpu": "Intel Iris Xe / UHD Graphics",
      "resolution": "1920x1080 (FHD)",
      "os": "Windows 11"
    }
  },
  {
    "brand": "Apple",
    "name": "MacBook Pro 16 2023 Laptop",
    "fullName": "Apple MacBook Pro 16 2023 Laptop",
    "defaultSpecs": {
      "cpu": "Apple M3 Max",
      "ram": "48GB",
      "storage": "1TB SSD",
      "screenSize": "16.2\"",
      "gpu": "Apple M-Series GPU",
      "resolution": "1920x1080 (FHD)",
      "os": "macOS"
    }
  },
  {
    "brand": "Asus",
    "name": "Vivobook 15 X1502ZA-EJ385WS Laptop",
    "fullName": "Asus Vivobook 15 X1502ZA-EJ385WS Laptop",
    "defaultSpecs": {
      "cpu": "12th Gen Core i3",
      "ram": "8GB",
      "storage": "512GB SSD",
      "screenSize": "15.6\"",
      "gpu": "Intel Iris Xe / UHD Graphics",
      "resolution": "1920x1080 (FHD)",
      "os": "Windows 11"
    }
  },
  {
    "brand": "Asus",
    "name": "VivoBook 15 X1500EA-EJ311W Laptop",
    "fullName": "Asus VivoBook 15 X1500EA-EJ311W Laptop",
    "defaultSpecs": {
      "cpu": "11th Gen Core i3",
      "ram": "8GB",
      "storage": "256GB SSD",
      "screenSize": "15.6\"",
      "gpu": "Intel Iris Xe / UHD Graphics",
      "resolution": "1920x1080 (FHD)",
      "os": "Windows 11"
    }
  },
  {
    "brand": "Acer",
    "name": "Nitro V ANV15-51 2023 Gaming Laptop",
    "fullName": "Acer Nitro V ANV15-51 2023 Gaming Laptop",
    "defaultSpecs": {
      "cpu": "13th Gen Core i5",
      "ram": "16GB",
      "storage": "512GB SSD",
      "screenSize": "15.6\"",
      "gpu": "NVIDIA GeForce Dedicated",
      "resolution": "1920x1080 (FHD)",
      "os": "Windows 11"
    }
  },
  {
    "brand": "HP",
    "name": "Victus 16-s0094AX Gaming Laptop",
    "fullName": "HP Victus 16-s0094AX Gaming Laptop",
    "defaultSpecs": {
      "cpu": "AMD Ryzen 7 7840HS",
      "ram": "16GB",
      "storage": "1TB SSD",
      "screenSize": "16.1\"",
      "gpu": "NVIDIA GeForce Dedicated",
      "resolution": "1920x1080 (FHD)",
      "os": "Windows 11"
    }
  },
  {
    "brand": "Ultimus",
    "name": "Elite NU14U3INF56BN-CS Laptop",
    "fullName": "Ultimus Elite NU14U3INF56BN-CS Laptop",
    "defaultSpecs": {
      "cpu": "10th Gen Core i5",
      "ram": "8GB",
      "storage": "512GB SSD",
      "screenSize": "14.1\"",
      "gpu": "Intel Iris Xe / UHD Graphics",
      "resolution": "1920x1080 (FHD)",
      "os": "Windows 11"
    }
  },
  {
    "brand": "HP",
    "name": "Pavilion 15-eg3081TU Laptop",
    "fullName": "HP Pavilion 15-eg3081TU Laptop",
    "defaultSpecs": {
      "cpu": "13th Gen Core i5",
      "ram": "16GB",
      "storage": "512GB SSD",
      "screenSize": "15.6\"",
      "gpu": "Intel Iris Xe / UHD Graphics",
      "resolution": "1920x1080 (FHD)",
      "os": "Windows 11"
    }
  },
  {
    "brand": "MSI",
    "name": "GF63 Thin 11UC-1294IN Gaming Laptop",
    "fullName": "MSI GF63 Thin 11UC-1294IN Gaming Laptop",
    "defaultSpecs": {
      "cpu": "11th Gen Core i7",
      "ram": "16GB",
      "storage": "512GB SSD",
      "screenSize": "15.6\"",
      "gpu": "NVIDIA GeForce Dedicated",
      "resolution": "1920x1080 (FHD)",
      "os": "Windows 11"
    }
  },
  {
    "brand": "Samsung",
    "name": "Galaxy Book2 NP550XED-KA1IN 15 Laptop",
    "fullName": "Samsung Galaxy Book2 NP550XED-KA1IN 15 Laptop",
    "defaultSpecs": {
      "cpu": "12th Gen Core i5",
      "ram": "8GB",
      "storage": "512GB SSD",
      "screenSize": "15.6\"",
      "gpu": "Intel Iris Xe / UHD Graphics",
      "resolution": "1920x1080 (FHD)",
      "os": "Windows 11"
    }
  },
  {
    "brand": "Samsung",
    "name": "Galaxy Book2 NP550XED-KA2IN Laptop",
    "fullName": "Samsung Galaxy Book2 NP550XED-KA2IN Laptop",
    "defaultSpecs": {
      "cpu": "12th Gen Core i5",
      "ram": "16GB",
      "storage": "512GB SSD",
      "screenSize": "15.6\"",
      "gpu": "Intel Iris Xe / UHD Graphics",
      "resolution": "1920x1080 (FHD)",
      "os": "Windows 11"
    }
  },
  {
    "brand": "Lenovo",
    "name": "IdeaPad Gaming 3 15IHU6 82K101GSIN Laptop",
    "fullName": "Lenovo IdeaPad Gaming 3 15IHU6 82K101GSIN Laptop",
    "defaultSpecs": {
      "cpu": "11th Gen Core i5",
      "ram": "8GB",
      "storage": "512GB SSD",
      "screenSize": "15.6\"",
      "gpu": "NVIDIA GeForce Dedicated",
      "resolution": "1920x1080 (FHD)",
      "os": "Windows 11"
    }
  },
  {
    "brand": "Asus",
    "name": "Vivobook 16X 2022 M1603QA-MB502WS Laptop",
    "fullName": "Asus Vivobook 16X 2022 M1603QA-MB502WS Laptop",
    "defaultSpecs": {
      "cpu": "Ryzen 5-5600H",
      "ram": "8GB",
      "storage": "512GB SSD",
      "screenSize": "16.0\"",
      "gpu": "Intel Iris Xe / UHD Graphics",
      "resolution": "1920x1080 (FHD)",
      "os": "Windows 11"
    }
  },
  {
    "brand": "Apple",
    "name": "MacBook Air 2022 Laptop",
    "fullName": "Apple MacBook Air 2022 Laptop",
    "defaultSpecs": {
      "cpu": "Apple M2",
      "ram": "8GB",
      "storage": "256GB SSD",
      "screenSize": "13.6\"",
      "gpu": "Apple M-Series GPU",
      "resolution": "1920x1080 (FHD)",
      "os": "macOS"
    }
  },
  {
    "brand": "Dell",
    "name": "G15-5520 Laptop",
    "fullName": "Dell G15-5520 Laptop",
    "defaultSpecs": {
      "cpu": "12th Gen Core i5",
      "ram": "16GB",
      "storage": "512GB SSD",
      "screenSize": "15.6\"",
      "gpu": "NVIDIA GeForce Dedicated",
      "resolution": "1920x1080 (FHD)",
      "os": "Windows 11"
    }
  },
  {
    "brand": "Acer",
    "name": "Aspire Lite AL15-52 15 Laptop",
    "fullName": "Acer Aspire Lite AL15-52 15 Laptop",
    "defaultSpecs": {
      "cpu": "12th Gen Core i5",
      "ram": "16GB",
      "storage": "1TB SSD",
      "screenSize": "15.6\"",
      "gpu": "Intel Iris Xe / UHD Graphics",
      "resolution": "1920x1080 (FHD)",
      "os": "Windows 11"
    }
  },
  {
    "brand": "Acer",
    "name": "Aspire Lite 15 AL15-52 Laptop",
    "fullName": "Acer Aspire Lite 15 AL15-52 Laptop",
    "defaultSpecs": {
      "cpu": "12th Gen Core i3",
      "ram": "16GB",
      "storage": "512GB SSD",
      "screenSize": "15.6\"",
      "gpu": "Intel Iris Xe / UHD Graphics",
      "resolution": "1920x1080 (FHD)",
      "os": "Windows 11"
    }
  },
  {
    "brand": "HP",
    "name": "15s-fr5011TU Laptop",
    "fullName": "HP 15s-fr5011TU Laptop",
    "defaultSpecs": {
      "cpu": "12th Gen Core i5",
      "ram": "16GB",
      "storage": "512GB SSD",
      "screenSize": "15.6\"",
      "gpu": "Intel Iris Xe / UHD Graphics",
      "resolution": "1920x1080 (FHD)",
      "os": "Windows 11"
    }
  },
  {
    "brand": "Asus",
    "name": "Vivobook 16X 2023 K3605ZF-MB541WS Laptop",
    "fullName": "Asus Vivobook 16X 2023 K3605ZF-MB541WS Laptop",
    "defaultSpecs": {
      "cpu": "12th Gen Core i5",
      "ram": "16GB",
      "storage": "512GB SSD",
      "screenSize": "16.0\"",
      "gpu": "NVIDIA GeForce Dedicated",
      "resolution": "1920x1080 (FHD)",
      "os": "Windows 11"
    }
  },
  {
    "brand": "Asus",
    "name": "ROG Flow X13 GV301RC-LJ132WS Gaming Laptop",
    "fullName": "Asus ROG Flow X13 GV301RC-LJ132WS Gaming Laptop",
    "defaultSpecs": {
      "cpu": "AMD Ryzen 9 6900HS",
      "ram": "16GB",
      "storage": "512GB SSD",
      "screenSize": "13.4\"",
      "gpu": "NVIDIA GeForce Dedicated",
      "resolution": "1920x1080 (FHD)",
      "os": "Windows 11"
    }
  },
  {
    "brand": "HP",
    "name": "Victus 15-fa1062TX Gaming Laptop",
    "fullName": "HP Victus 15-fa1062TX Gaming Laptop",
    "defaultSpecs": {
      "cpu": "13th Gen Core i5",
      "ram": "16GB",
      "storage": "512GB SSD",
      "screenSize": "15.6\"",
      "gpu": "NVIDIA GeForce Dedicated",
      "resolution": "1920x1080 (FHD)",
      "os": "Windows 11"
    }
  },
  {
    "brand": "HP",
    "name": "Victus 15-fb0150AX Gaming Laptop",
    "fullName": "HP Victus 15-fb0150AX Gaming Laptop",
    "defaultSpecs": {
      "cpu": "AMD Ryzen 5 5600H",
      "ram": "16GB",
      "storage": "512GB SSD",
      "screenSize": "15.6\"",
      "gpu": "AMD Radeon Dedicated",
      "resolution": "1920x1080 (FHD)",
      "os": "Windows 11"
    }
  },
  {
    "brand": "HP",
    "name": "Omen 16-xf0060AX Gaming Laptop",
    "fullName": "HP Omen 16-xf0060AX Gaming Laptop",
    "defaultSpecs": {
      "cpu": "AMD Ryzen 7 7840HS",
      "ram": "16GB",
      "storage": "1TB SSD",
      "screenSize": "16.0\"",
      "gpu": "NVIDIA GeForce Dedicated",
      "resolution": "1920x1080 (FHD)",
      "os": "Windows 11"
    }
  },
  {
    "brand": "HP",
    "name": "Victus 15-fa0555TX  Laptop",
    "fullName": "HP Victus 15-fa0555TX  Laptop",
    "defaultSpecs": {
      "cpu": "12th Gen Core i5",
      "ram": "16GB",
      "storage": "512GB SSD",
      "screenSize": "15.6\"",
      "gpu": "NVIDIA GeForce Dedicated",
      "resolution": "1920x1080 (FHD)",
      "os": "Windows 11"
    }
  },
  {
    "brand": "Dell",
    "name": "G15-5530 GN5530D83M6002ORB1 Gaming Laptop",
    "fullName": "Dell G15-5530 GN5530D83M6002ORB1 Gaming Laptop",
    "defaultSpecs": {
      "cpu": "13th Gen Core i5",
      "ram": "16GB",
      "storage": "512GB SSD",
      "screenSize": "15.6\"",
      "gpu": "NVIDIA GeForce Dedicated",
      "resolution": "1920x1080 (FHD)",
      "os": "Windows 11"
    }
  },
  {
    "brand": "MSI",
    "name": "Modern 14 C11M-030IN Laptop",
    "fullName": "MSI Modern 14 C11M-030IN Laptop",
    "defaultSpecs": {
      "cpu": "11th Gen Core i5",
      "ram": "8GB",
      "storage": "512GB SSD",
      "screenSize": "14.0\"",
      "gpu": "Intel Iris Xe / UHD Graphics",
      "resolution": "1920x1080 (FHD)",
      "os": "Windows 11"
    }
  },
  {
    "brand": "Asus",
    "name": "ROG Strix SCAR 16 2023 G634JZ-NM057WS Gaming Laptop",
    "fullName": "Asus ROG Strix SCAR 16 2023 G634JZ-NM057WS Gaming Laptop",
    "defaultSpecs": {
      "cpu": "13th Gen Core i9",
      "ram": "32GB",
      "storage": "1TB SSD",
      "screenSize": "16.0\"",
      "gpu": "NVIDIA GeForce Dedicated",
      "resolution": "1920x1080 (FHD)",
      "os": "Windows 11"
    }
  },
  {
    "brand": "MSI",
    "name": "Thin GF63 12VE-071IN Gaming Laptop",
    "fullName": "MSI Thin GF63 12VE-071IN Gaming Laptop",
    "defaultSpecs": {
      "cpu": "12th Gen Core i5",
      "ram": "16GB",
      "storage": "512GB SSD",
      "screenSize": "15.6\"",
      "gpu": "NVIDIA GeForce Dedicated",
      "resolution": "1920x1080 (FHD)",
      "os": "Windows 11"
    }
  },
  {
    "brand": "Dell",
    "name": "Vostro 3425 Laptop",
    "fullName": "Dell Vostro 3425 Laptop",
    "defaultSpecs": {
      "cpu": "AMD Ryzen 5 5625U",
      "ram": "8GB",
      "storage": "512GB SSD",
      "screenSize": "14.0\"",
      "gpu": "Intel Iris Xe / UHD Graphics",
      "resolution": "1920x1080 (FHD)",
      "os": "Windows 11"
    }
  },
  {
    "brand": "Infinix",
    "name": "INBook Y1 Plus 15 XL28 Laptop",
    "fullName": "Infinix INBook Y1 Plus 15 XL28 Laptop",
    "defaultSpecs": {
      "cpu": "10th Gen Core i5",
      "ram": "8GB",
      "storage": "512GB SSD",
      "screenSize": "15.6\"",
      "gpu": "Intel Iris Xe / UHD Graphics",
      "resolution": "1920x1080 (FHD)",
      "os": "Windows 11"
    }
  },
  {
    "brand": "Acer",
    "name": "Aspire Lite AL15-52 Laptop",
    "fullName": "Acer Aspire Lite AL15-52 Laptop",
    "defaultSpecs": {
      "cpu": "12th Gen Core i3",
      "ram": "8GB",
      "storage": "512GB SSD",
      "screenSize": "15.6\"",
      "gpu": "Intel Iris Xe / UHD Graphics",
      "resolution": "1920x1080 (FHD)",
      "os": "Windows 11"
    }
  },
  {
    "brand": "HP",
    "name": "Victus 16-s0095AX Gaming Laptop",
    "fullName": "HP Victus 16-s0095AX Gaming Laptop",
    "defaultSpecs": {
      "cpu": "AMD Ryzen 7 7840HS",
      "ram": "16GB",
      "storage": "512GB SSD",
      "screenSize": "16.1\"",
      "gpu": "NVIDIA GeForce Dedicated",
      "resolution": "1920x1080 (FHD)",
      "os": "Windows 11"
    }
  },
  {
    "brand": "HP",
    "name": "Victus 15-FB1001AX Gaming Laptop",
    "fullName": "HP Victus 15-FB1001AX Gaming Laptop",
    "defaultSpecs": {
      "cpu": "AMD Ryzen 5 7535HS",
      "ram": "8GB",
      "storage": "512GB SSD",
      "screenSize": "15.6\"",
      "gpu": "NVIDIA GeForce Dedicated",
      "resolution": "1920x1080 (FHD)",
      "os": "Windows 11"
    }
  },
  {
    "brand": "HP",
    "name": "15s-eq2132AU Laptop",
    "fullName": "HP 15s-eq2132AU Laptop",
    "defaultSpecs": {
      "cpu": "AMD Ryzen 5 5500U",
      "ram": "16GB",
      "storage": "512GB SSD",
      "screenSize": "15.6\"",
      "gpu": "Intel Iris Xe / UHD Graphics",
      "resolution": "1920x1080 (FHD)",
      "os": "Windows 11"
    }
  },
  {
    "brand": "Infinix",
    "name": "INBook X3 Slim XL422 2023 Laptop",
    "fullName": "Infinix INBook X3 Slim XL422 2023 Laptop",
    "defaultSpecs": {
      "cpu": "12th Gen Core i3",
      "ram": "8GB",
      "storage": "512GB SSD",
      "screenSize": "14.0\"",
      "gpu": "Intel Iris Xe / UHD Graphics",
      "resolution": "1920x1080 (FHD)",
      "os": "Windows 11"
    }
  },
  {
    "brand": "HP",
    "name": "Omen 16-u0005TX Gaming Laptop",
    "fullName": "HP Omen 16-u0005TX Gaming Laptop",
    "defaultSpecs": {
      "cpu": "13th Gen Core i7",
      "ram": "16GB",
      "storage": "1TB SSD",
      "screenSize": "16.1\"",
      "gpu": "NVIDIA GeForce Dedicated",
      "resolution": "1920x1080 (FHD)",
      "os": "Windows 11"
    }
  },
  {
    "brand": "Asus",
    "name": "TUF Gaming F17 FX707ZC4-HX067W Gaming Laptop",
    "fullName": "Asus TUF Gaming F17 FX707ZC4-HX067W Gaming Laptop",
    "defaultSpecs": {
      "cpu": "12th Gen Core i5",
      "ram": "16GB",
      "storage": "512GB SSD",
      "screenSize": "17.3\"",
      "gpu": "NVIDIA GeForce Dedicated",
      "resolution": "1920x1080 (FHD)",
      "os": "Windows 11"
    }
  },
  {
    "brand": "Dell",
    "name": "Inspiron 5430 Laptop",
    "fullName": "Dell Inspiron 5430 Laptop",
    "defaultSpecs": {
      "cpu": "13th Gen Core i7",
      "ram": "16GB",
      "storage": "1TB SSD",
      "screenSize": "14.0\"",
      "gpu": "Intel Iris Xe / UHD Graphics",
      "resolution": "1920x1080 (FHD)",
      "os": "Windows 11"
    }
  },
  {
    "brand": "Asus",
    "name": "Vivobook 15 X1502ZA-EJ741WS Laptop",
    "fullName": "Asus Vivobook 15 X1502ZA-EJ741WS Laptop",
    "defaultSpecs": {
      "cpu": "12th Gen Core i7",
      "ram": "16GB",
      "storage": "512GB SSD",
      "screenSize": "15.6\"",
      "gpu": "Intel Iris Xe / UHD Graphics",
      "resolution": "1920x1080 (FHD)",
      "os": "Windows 11"
    }
  },
  {
    "brand": "Lenovo",
    "name": "Ideapad Gaming 3 82SB00NXIN Laptop",
    "fullName": "Lenovo Ideapad Gaming 3 82SB00NXIN Laptop",
    "defaultSpecs": {
      "cpu": "AMD Ryzen 5 7535HS",
      "ram": "16GB",
      "storage": "512GB SSD",
      "screenSize": "15.6\"",
      "gpu": "NVIDIA GeForce Dedicated",
      "resolution": "1920x1080 (FHD)",
      "os": "Windows 11"
    }
  },
  {
    "brand": "Dell",
    "name": "Inspiron 5630 Laptop",
    "fullName": "Dell Inspiron 5630 Laptop",
    "defaultSpecs": {
      "cpu": "13th Gen Core i5",
      "ram": "16GB",
      "storage": "512GB SSD",
      "screenSize": "16.0\"",
      "gpu": "Intel Iris Xe / UHD Graphics",
      "resolution": "1920x1080 (FHD)",
      "os": "Windows 11"
    }
  },
  {
    "brand": "Asus",
    "name": "VivoBook 14 X415EA-EK344WS Notebook",
    "fullName": "Asus VivoBook 14 X415EA-EK344WS Notebook",
    "defaultSpecs": {
      "cpu": "11th Gen Core i3",
      "ram": "16GB",
      "storage": "512GB SSD",
      "screenSize": "14.0\"",
      "gpu": "Intel Iris Xe / UHD Graphics",
      "resolution": "1920x1080 (FHD)",
      "os": "Windows 11"
    }
  },
  {
    "brand": "Asus",
    "name": "TUF Gaming F15 2023 FX507ZV-LP094W Gaming Laptop",
    "fullName": "Asus TUF Gaming F15 2023 FX507ZV-LP094W Gaming Laptop",
    "defaultSpecs": {
      "cpu": "12th Gen Core i7",
      "ram": "16GB",
      "storage": "512GB SSD",
      "screenSize": "15.6\"",
      "gpu": "NVIDIA GeForce Dedicated",
      "resolution": "1920x1080 (FHD)",
      "os": "Windows 11"
    }
  },
  {
    "brand": "Asus",
    "name": "TUF Gaming F15 FX506HF-HN025W Gaming Laptop",
    "fullName": "Asus TUF Gaming F15 FX506HF-HN025W Gaming Laptop",
    "defaultSpecs": {
      "cpu": "11th Gen Core i5",
      "ram": "16GB",
      "storage": "512GB SSD",
      "screenSize": "15.6\"",
      "gpu": "NVIDIA GeForce Dedicated",
      "resolution": "1920x1080 (FHD)",
      "os": "Windows 11"
    }
  },
  {
    "brand": "HP",
    "name": "Victus 15-fa0998TX Gaming Laptop",
    "fullName": "HP Victus 15-fa0998TX Gaming Laptop",
    "defaultSpecs": {
      "cpu": "12th Gen Core i5",
      "ram": "16GB",
      "storage": "512GB SSD",
      "screenSize": "15.6\"",
      "gpu": "NVIDIA GeForce Dedicated",
      "resolution": "1920x1080 (FHD)",
      "os": "Windows 11"
    }
  },
  {
    "brand": "HP",
    "name": "Victus 15-fa0666TX Gaming Laptop",
    "fullName": "HP Victus 15-fa0666TX Gaming Laptop",
    "defaultSpecs": {
      "cpu": "12th Gen Core i5",
      "ram": "16GB",
      "storage": "512GB SSD",
      "screenSize": "15.6\"",
      "gpu": "NVIDIA GeForce Dedicated",
      "resolution": "1920x1080 (FHD)",
      "os": "Windows 11"
    }
  },
  {
    "brand": "Apple",
    "name": "MacBook Air 15 2023 Laptop",
    "fullName": "Apple MacBook Air 15 2023 Laptop",
    "defaultSpecs": {
      "cpu": "Apple M2",
      "ram": "8GB",
      "storage": "256GB SSD",
      "screenSize": "15.3\"",
      "gpu": "Apple M-Series GPU",
      "resolution": "1920x1080 (FHD)",
      "os": "macOS"
    }
  },
  {
    "brand": "Infinix",
    "name": "INBook Y1 Plus Neo XL30 Laptop",
    "fullName": "Infinix INBook Y1 Plus Neo XL30 Laptop",
    "defaultSpecs": {
      "cpu": "Intel Celeron N5100",
      "ram": "8GB",
      "storage": "512GB SSD",
      "screenSize": "15.6\"",
      "gpu": "Intel Iris Xe / UHD Graphics",
      "resolution": "1920x1080 (FHD)",
      "os": "Windows 11"
    }
  },
  {
    "brand": "HP",
    "name": "Pavilion x360 14-ek1010TU Laptop",
    "fullName": "HP Pavilion x360 14-ek1010TU Laptop",
    "defaultSpecs": {
      "cpu": "13th Gen Core i5",
      "ram": "16GB",
      "storage": "1TB SSD",
      "screenSize": "14.0\"",
      "gpu": "Intel Iris Xe / UHD Graphics",
      "resolution": "1920x1080 (FHD)",
      "os": "Windows 11"
    }
  },
  {
    "brand": "Primebook",
    "name": "4G Android Laptop",
    "fullName": "Primebook 4G Android Laptop",
    "defaultSpecs": {
      "cpu": "MediaTek Kompanio 500",
      "ram": "4GB",
      "storage": "64GB EMMC",
      "screenSize": "11.6\"",
      "gpu": "Intel Iris Xe / UHD Graphics",
      "resolution": "1920x1080 (FHD)",
      "os": "Windows 11"
    }
  },
  {
    "brand": "Dell",
    "name": "Inspiron 3520 Laptop",
    "fullName": "Dell Inspiron 3520 Laptop",
    "defaultSpecs": {
      "cpu": "12th Gen Core i5",
      "ram": "8GB",
      "storage": "512GB SSD",
      "screenSize": "15.6\"",
      "gpu": "Intel Iris Xe / UHD Graphics",
      "resolution": "1920x1080 (FHD)",
      "os": "Windows 11"
    }
  },
  {
    "brand": "Acer",
    "name": "Aspire 5 A515-57G UN.K9TSI.002 Gaming Laptop",
    "fullName": "Acer Aspire 5 A515-57G UN.K9TSI.002 Gaming Laptop",
    "defaultSpecs": {
      "cpu": "12th Gen Core i5",
      "ram": "16GB",
      "storage": "512GB SSD",
      "screenSize": "15.6\"",
      "gpu": "NVIDIA GeForce Dedicated",
      "resolution": "1920x1080 (FHD)",
      "os": "Windows 11"
    }
  },
  {
    "brand": "HP",
    "name": "Victus 15-fa0070TX Laptop",
    "fullName": "HP Victus 15-fa0070TX Laptop",
    "defaultSpecs": {
      "cpu": "12th Gen Core i5",
      "ram": "8GB",
      "storage": "512GB SSD",
      "screenSize": "15.6\"",
      "gpu": "NVIDIA GeForce Dedicated",
      "resolution": "1920x1080 (FHD)",
      "os": "Windows 11"
    }
  },
  {
    "brand": "HP",
    "name": "Victus 16-e0352AX Gaming Laptop",
    "fullName": "HP Victus 16-e0352AX Gaming Laptop",
    "defaultSpecs": {
      "cpu": "Ryzen 5-5600H",
      "ram": "8GB",
      "storage": "512GB SSD",
      "screenSize": "16.1\"",
      "gpu": "NVIDIA GeForce Dedicated",
      "resolution": "1920x1080 (FHD)",
      "os": "Windows 11"
    }
  },
  {
    "brand": "Asus",
    "name": "Vivobook S14 OLED S3402ZA-KM501WS Laptop",
    "fullName": "Asus Vivobook S14 OLED S3402ZA-KM501WS Laptop",
    "defaultSpecs": {
      "cpu": "12th Gen Core i5",
      "ram": "16GB",
      "storage": "512GB SSD",
      "screenSize": "14.0\"",
      "gpu": "Intel Iris Xe / UHD Graphics",
      "resolution": "1920x1080 (FHD)",
      "os": "Windows 11"
    }
  },
  {
    "brand": "Asus",
    "name": "Vivobook S15 OLED K3502ZA-L501WS Laptop",
    "fullName": "Asus Vivobook S15 OLED K3502ZA-L501WS Laptop",
    "defaultSpecs": {
      "cpu": "12th Gen Core i5",
      "ram": "16GB",
      "storage": "512GB SSD",
      "screenSize": "15.6\"",
      "gpu": "Intel Iris Xe / UHD Graphics",
      "resolution": "1920x1080 (FHD)",
      "os": "Windows 11"
    }
  },
  {
    "brand": "iBall",
    "name": "Excelance CompBook Laptop",
    "fullName": "iBall Excelance CompBook Laptop",
    "defaultSpecs": {
      "cpu": "AQC",
      "ram": "2GB",
      "storage": "512GB SSD",
      "screenSize": "11.6\"",
      "gpu": "Intel Iris Xe / UHD Graphics",
      "resolution": "1920x1080 (FHD)",
      "os": "Windows 11"
    }
  },
  {
    "brand": "Ultimus",
    "name": "Lite NU14U3INC54BN Laptop",
    "fullName": "Ultimus Lite NU14U3INC54BN Laptop",
    "defaultSpecs": {
      "cpu": "Celeron N4020",
      "ram": "8GB",
      "storage": "256GB SSD",
      "screenSize": "14.1\"",
      "gpu": "Intel Iris Xe / UHD Graphics",
      "resolution": "1920x1080 (FHD)",
      "os": "Windows 11"
    }
  },
  {
    "brand": "Dell",
    "name": "G15-5530 Gaming Laptop",
    "fullName": "Dell G15-5530 Gaming Laptop",
    "defaultSpecs": {
      "cpu": "13th Gen Core i5",
      "ram": "16GB",
      "storage": "1TB SSD",
      "screenSize": "15.6\"",
      "gpu": "NVIDIA GeForce Dedicated",
      "resolution": "1920x1080 (FHD)",
      "os": "Windows 11"
    }
  },
  {
    "brand": "Asus",
    "name": "VivoBook 14 X1400EA-EK543WS Notebook",
    "fullName": "Asus VivoBook 14 X1400EA-EK543WS Notebook",
    "defaultSpecs": {
      "cpu": "11th Gen Core i5",
      "ram": "16GB",
      "storage": "512GB SSD",
      "screenSize": "14.0\"",
      "gpu": "Intel Iris Xe / UHD Graphics",
      "resolution": "1920x1080 (FHD)",
      "os": "Windows 11"
    }
  },
  {
    "brand": "HP",
    "name": "Pavilion 15-EG2119TU Laptop",
    "fullName": "HP Pavilion 15-EG2119TU Laptop",
    "defaultSpecs": {
      "cpu": "12th Gen Core i5",
      "ram": "12GB",
      "storage": "512GB SSD",
      "screenSize": "15.6\"",
      "gpu": "Intel Iris Xe / UHD Graphics",
      "resolution": "1920x1080 (FHD)",
      "os": "Windows 11"
    }
  },
  {
    "brand": "Lenovo",
    "name": "IdeaPad Slim 3 82X60013IN Laptop",
    "fullName": "Lenovo IdeaPad Slim 3 82X60013IN Laptop",
    "defaultSpecs": {
      "cpu": "13th Gen Core i3",
      "ram": "8GB",
      "storage": "512GB SSD",
      "screenSize": "15.6\"",
      "gpu": "Intel Iris Xe / UHD Graphics",
      "resolution": "1920x1080 (FHD)",
      "os": "Windows 11"
    }
  },
  {
    "brand": "Lenovo",
    "name": "ThinkBook 15 G5 21JF002JIN Laptop",
    "fullName": "Lenovo ThinkBook 15 G5 21JF002JIN Laptop",
    "defaultSpecs": {
      "cpu": "AMD Ryzen 3 7330U",
      "ram": "8GB",
      "storage": "512GB SSD",
      "screenSize": "15.6\"",
      "gpu": "Intel Iris Xe / UHD Graphics",
      "resolution": "1920x1080 (FHD)",
      "os": "Windows 11"
    }
  },
  {
    "brand": "HP",
    "name": "Victus 15-fa1145TX Gaming Laptop",
    "fullName": "HP Victus 15-fa1145TX Gaming Laptop",
    "defaultSpecs": {
      "cpu": "12th Gen Core i5",
      "ram": "16GB",
      "storage": "1TB SSD",
      "screenSize": "15.6\"",
      "gpu": "NVIDIA GeForce Dedicated",
      "resolution": "1920x1080 (FHD)",
      "os": "Windows 11"
    }
  },
  {
    "brand": "Lenovo",
    "name": "V15 G4 Laptop",
    "fullName": "Lenovo V15 G4 Laptop",
    "defaultSpecs": {
      "cpu": "AMD Athlon Silver 7120U",
      "ram": "8GB",
      "storage": "512GB SSD",
      "screenSize": "15.6\"",
      "gpu": "Intel Iris Xe / UHD Graphics",
      "resolution": "1920x1080 (FHD)",
      "os": "Windows 11"
    }
  },
  {
    "brand": "HP",
    "name": "Victus 15-fb1002AX Gaming Laptop",
    "fullName": "HP Victus 15-fb1002AX Gaming Laptop",
    "defaultSpecs": {
      "cpu": "AMD Ryzen 5 7535HS",
      "ram": "8GB",
      "storage": "512GB SSD",
      "screenSize": "15.6\"",
      "gpu": "NVIDIA GeForce Dedicated",
      "resolution": "1920x1080 (FHD)",
      "os": "Windows 11"
    }
  },
  {
    "brand": "MSI",
    "name": "Thin GF63 11SC-1629IN Gaming Laptop",
    "fullName": "MSI Thin GF63 11SC-1629IN Gaming Laptop",
    "defaultSpecs": {
      "cpu": "11th Gen Core i5",
      "ram": "16GB",
      "storage": "512GB SSD",
      "screenSize": "15.6\"",
      "gpu": "NVIDIA GeForce Dedicated",
      "resolution": "1920x1080 (FHD)",
      "os": "Windows 11"
    }
  },
  {
    "brand": "Ultimus",
    "name": "Pro NU14U3INC43BN-CS Laptop",
    "fullName": "Ultimus Pro NU14U3INC43BN-CS Laptop",
    "defaultSpecs": {
      "cpu": "Celeron N4020",
      "ram": "4GB",
      "storage": "128GB SSD",
      "screenSize": "14.1\"",
      "gpu": "Intel Iris Xe / UHD Graphics",
      "resolution": "1920x1080 (FHD)",
      "os": "Windows 11"
    }
  },
  {
    "brand": "Lenovo",
    "name": "ThinkBook 15 G5 21JFA00BIN Laptop",
    "fullName": "Lenovo ThinkBook 15 G5 21JFA00BIN Laptop",
    "defaultSpecs": {
      "cpu": "AMD Ryzen 7 7730U",
      "ram": "8GB",
      "storage": "512GB SSD",
      "screenSize": "15.6\"",
      "gpu": "Intel Iris Xe / UHD Graphics",
      "resolution": "1920x1080 (FHD)",
      "os": "Windows 11"
    }
  },
  {
    "brand": "MSI",
    "name": "Katana 15 B13UDXK-1482IN Gaming Laptop",
    "fullName": "MSI Katana 15 B13UDXK-1482IN Gaming Laptop",
    "defaultSpecs": {
      "cpu": "13th Gen Core i5",
      "ram": "32GB",
      "storage": "1TB SSD",
      "screenSize": "15.6\"",
      "gpu": "NVIDIA GeForce Dedicated",
      "resolution": "1920x1080 (FHD)",
      "os": "Windows 11"
    }
  },
  {
    "brand": "MSI",
    "name": "Bravo 15 B7ED-012IN Gaming Laptop",
    "fullName": "MSI Bravo 15 B7ED-012IN Gaming Laptop",
    "defaultSpecs": {
      "cpu": "AMD Ryzen 5 7535HS",
      "ram": "8GB",
      "storage": "512GB SSD",
      "screenSize": "15.6\"",
      "gpu": "AMD Radeon Dedicated",
      "resolution": "1920x1080 (FHD)",
      "os": "Windows 11"
    }
  },
  {
    "brand": "Asus",
    "name": "Vivobook 15 X1502ZA-EJ544WS Laptop",
    "fullName": "Asus Vivobook 15 X1502ZA-EJ544WS Laptop",
    "defaultSpecs": {
      "cpu": "12th Gen Core i5",
      "ram": "16GB",
      "storage": "512GB SSD",
      "screenSize": "15.6\"",
      "gpu": "Intel Iris Xe / UHD Graphics",
      "resolution": "1920x1080 (FHD)",
      "os": "Windows 11"
    }
  },
  {
    "brand": "Asus",
    "name": "Vivobook 16 2023 X1605VA-MB947WS Laptop",
    "fullName": "Asus Vivobook 16 2023 X1605VA-MB947WS Laptop",
    "defaultSpecs": {
      "cpu": "13th Gen Core i9",
      "ram": "16GB",
      "storage": "512GB SSD",
      "screenSize": "16.0\"",
      "gpu": "Intel Iris Xe / UHD Graphics",
      "resolution": "1920x1080 (FHD)",
      "os": "Windows 11"
    }
  },
  {
    "brand": "Lenovo",
    "name": "IdeaPad Gaming 3 82SB00V3IN Laptop",
    "fullName": "Lenovo IdeaPad Gaming 3 82SB00V3IN Laptop",
    "defaultSpecs": {
      "cpu": "AMD Ryzen 5 6600H",
      "ram": "16GB",
      "storage": "512GB SSD",
      "screenSize": "15.6\"",
      "gpu": "NVIDIA GeForce Dedicated",
      "resolution": "1920x1080 (FHD)",
      "os": "Windows 11"
    }
  },
  {
    "brand": "HP",
    "name": "EliteBook 840 G6 (8LX79PA) Laptop",
    "fullName": "HP EliteBook 840 G6 (8LX79PA) Laptop",
    "defaultSpecs": {
      "cpu": "8LX79PA) Laptop (8th Gen Core i5",
      "ram": "8GB",
      "storage": "512GB SSD",
      "screenSize": "14.0\"",
      "gpu": "Intel Iris Xe / UHD Graphics",
      "resolution": "1920x1080 (FHD)",
      "os": "Windows 11"
    }
  },
  {
    "brand": "HP",
    "name": "EliteBook 840 G5",
    "defaultSpecs": {
      "cpu": "Intel Core i5-8250U",
      "ram": "8GB",
      "storage": "256GB SSD",
      "screenSize": "14.0\"",
      "gpu": "Intel UHD Graphics 620",
      "resolution": "1920x1080 (FHD)",
      "os": "Windows 11"
    },
    "fullName": "HP EliteBook 840 G5"
  },
  {
    "brand": "HP",
    "name": "EliteBook 840 G6",
    "defaultSpecs": {
      "cpu": "Intel Core i5-8365U",
      "ram": "8GB",
      "storage": "256GB SSD",
      "screenSize": "14.0\"",
      "gpu": "Intel UHD Graphics 620",
      "resolution": "1920x1080 (FHD)",
      "os": "Windows 11"
    },
    "fullName": "HP EliteBook 840 G6"
  },
  {
    "brand": "HP",
    "name": "EliteBook 840 G7",
    "defaultSpecs": {
      "cpu": "Intel Core i5-10210U",
      "ram": "8GB",
      "storage": "256GB SSD",
      "screenSize": "14.0\"",
      "gpu": "Intel UHD Graphics",
      "resolution": "1920x1080 (FHD)",
      "os": "Windows 11"
    },
    "fullName": "HP EliteBook 840 G7"
  },
  {
    "brand": "HP",
    "name": "EliteBook 840 G8",
    "defaultSpecs": {
      "cpu": "Intel Core i5-1135G7",
      "ram": "8GB",
      "storage": "256GB SSD",
      "screenSize": "14.0\"",
      "gpu": "Intel Iris Xe",
      "resolution": "1920x1080 (FHD)",
      "os": "Windows 11"
    },
    "fullName": "HP EliteBook 840 G8"
  },
  {
    "brand": "HP",
    "name": "EliteBook 840 G9",
    "defaultSpecs": {
      "cpu": "Intel Core i5-1235U",
      "ram": "16GB",
      "storage": "512GB SSD",
      "screenSize": "14.0\"",
      "gpu": "Intel Iris Xe",
      "resolution": "1920x1200",
      "os": "Windows 11"
    },
    "fullName": "HP EliteBook 840 G9"
  },
  {
    "brand": "HP",
    "name": "Victus 15",
    "defaultSpecs": {
      "cpu": "AMD Ryzen 5 5600H",
      "ram": "8GB",
      "storage": "512GB SSD",
      "screenSize": "15.6\"",
      "gpu": "NVIDIA GeForce RTX 3050",
      "resolution": "1920x1080 (FHD)",
      "os": "Windows 11"
    },
    "fullName": "HP Victus 15"
  },
  {
    "brand": "HP",
    "name": "Victus 16",
    "defaultSpecs": {
      "cpu": "AMD Ryzen 7 7840HS",
      "ram": "16GB",
      "storage": "1TB SSD",
      "screenSize": "16.1\"",
      "gpu": "NVIDIA GeForce RTX 4060",
      "resolution": "1920x1080 (FHD)",
      "os": "Windows 11"
    },
    "fullName": "HP Victus 16"
  },
  {
    "brand": "HP",
    "name": "Omen 16",
    "defaultSpecs": {
      "cpu": "Intel Core i7-13700H",
      "ram": "16GB",
      "storage": "1TB SSD",
      "screenSize": "16.1\"",
      "gpu": "NVIDIA GeForce RTX 4070",
      "resolution": "2560x1440 (2K QHD)",
      "os": "Windows 11"
    },
    "fullName": "HP Omen 16"
  },
  {
    "brand": "HP",
    "name": "Pavilion 15",
    "defaultSpecs": {
      "cpu": "Intel Core i5-1235U",
      "ram": "8GB",
      "storage": "512GB SSD",
      "screenSize": "15.6\"",
      "gpu": "Intel Iris Xe",
      "resolution": "1920x1080 (FHD)",
      "os": "Windows 11"
    },
    "fullName": "HP Pavilion 15"
  },
  {
    "brand": "HP",
    "name": "ProBook 450 G8",
    "defaultSpecs": {
      "cpu": "Intel Core i5-1135G7",
      "ram": "8GB",
      "storage": "256GB SSD",
      "screenSize": "15.6\"",
      "gpu": "Intel Iris Xe",
      "resolution": "1920x1080 (FHD)",
      "os": "Windows 11"
    },
    "fullName": "HP ProBook 450 G8"
  },
  {
    "brand": "Dell",
    "name": "Latitude 5400",
    "defaultSpecs": {
      "cpu": "Intel Core i5-8265U",
      "ram": "8GB",
      "storage": "256GB SSD",
      "screenSize": "14.0\"",
      "gpu": "Intel UHD Graphics 620",
      "resolution": "1920x1080 (FHD)",
      "os": "Windows 11"
    },
    "fullName": "Dell Latitude 5400"
  },
  {
    "brand": "Dell",
    "name": "Latitude 5420",
    "defaultSpecs": {
      "cpu": "Intel Core i5-1135G7",
      "ram": "8GB",
      "storage": "256GB SSD",
      "screenSize": "14.0\"",
      "gpu": "Intel Iris Xe",
      "resolution": "1920x1080 (FHD)",
      "os": "Windows 11"
    },
    "fullName": "Dell Latitude 5420"
  },
  {
    "brand": "Dell",
    "name": "Latitude 7420",
    "defaultSpecs": {
      "cpu": "Intel Core i7-1185G7",
      "ram": "16GB",
      "storage": "512GB SSD",
      "screenSize": "14.0\"",
      "gpu": "Intel Iris Xe",
      "resolution": "1920x1080 (FHD)",
      "os": "Windows 11"
    },
    "fullName": "Dell Latitude 7420"
  },
  {
    "brand": "Dell",
    "name": "Inspiron 15 3520",
    "defaultSpecs": {
      "cpu": "Intel Core i5-1235U",
      "ram": "8GB",
      "storage": "512GB SSD",
      "screenSize": "15.6\"",
      "gpu": "Intel Iris Xe",
      "resolution": "1920x1080 (FHD)",
      "os": "Windows 11"
    },
    "fullName": "Dell Inspiron 15 3520"
  },
  {
    "brand": "Dell",
    "name": "Inspiron 15 3530",
    "defaultSpecs": {
      "cpu": "Intel Core i5-1335U",
      "ram": "16GB",
      "storage": "512GB SSD",
      "screenSize": "15.6\"",
      "gpu": "Intel Iris Xe",
      "resolution": "1920x1080 (FHD)",
      "os": "Windows 11"
    },
    "fullName": "Dell Inspiron 15 3530"
  },
  {
    "brand": "Dell",
    "name": "XPS 13 9310",
    "defaultSpecs": {
      "cpu": "Intel Core i7-1165G7",
      "ram": "16GB",
      "storage": "512GB SSD",
      "screenSize": "13.4\"",
      "gpu": "Intel Iris Xe",
      "resolution": "1920x1200",
      "os": "Windows 11"
    },
    "fullName": "Dell XPS 13 9310"
  },
  {
    "brand": "Dell",
    "name": "G15 5530",
    "defaultSpecs": {
      "cpu": "Intel Core i7-13650HX",
      "ram": "16GB",
      "storage": "1TB SSD",
      "screenSize": "15.6\"",
      "gpu": "NVIDIA GeForce RTX 4060",
      "resolution": "1920x1080 (FHD)",
      "os": "Windows 11"
    },
    "fullName": "Dell G15 5530"
  },
  {
    "brand": "Lenovo",
    "name": "ThinkPad T480",
    "defaultSpecs": {
      "cpu": "Intel Core i5-8250U",
      "ram": "8GB",
      "storage": "256GB SSD",
      "screenSize": "14.0\"",
      "gpu": "Intel UHD Graphics 620",
      "resolution": "1920x1080 (FHD)",
      "os": "Windows 11"
    },
    "fullName": "Lenovo ThinkPad T480"
  },
  {
    "brand": "Lenovo",
    "name": "ThinkPad T490",
    "defaultSpecs": {
      "cpu": "Intel Core i5-8265U",
      "ram": "8GB",
      "storage": "256GB SSD",
      "screenSize": "14.0\"",
      "gpu": "Intel UHD Graphics 620",
      "resolution": "1920x1080 (FHD)",
      "os": "Windows 11"
    },
    "fullName": "Lenovo ThinkPad T490"
  },
  {
    "brand": "Lenovo",
    "name": "ThinkPad T14 Gen 2",
    "defaultSpecs": {
      "cpu": "Intel Core i5-1135G7",
      "ram": "8GB",
      "storage": "256GB SSD",
      "screenSize": "14.0\"",
      "gpu": "Intel Iris Xe",
      "resolution": "1920x1080 (FHD)",
      "os": "Windows 11"
    },
    "fullName": "Lenovo ThinkPad T14 Gen 2"
  },
  {
    "brand": "Lenovo",
    "name": "ThinkPad X1 Carbon Gen 9",
    "defaultSpecs": {
      "cpu": "Intel Core i7-1165G7",
      "ram": "16GB",
      "storage": "512GB SSD",
      "screenSize": "14.0\"",
      "gpu": "Intel Iris Xe",
      "resolution": "1920x1200",
      "os": "Windows 11"
    },
    "fullName": "Lenovo ThinkPad X1 Carbon Gen 9"
  },
  {
    "brand": "Lenovo",
    "name": "IdeaPad 3 15",
    "defaultSpecs": {
      "cpu": "Intel Core i3-1115G4",
      "ram": "8GB",
      "storage": "256GB SSD",
      "screenSize": "15.6\"",
      "gpu": "Intel UHD Graphics",
      "resolution": "1920x1080 (FHD)",
      "os": "Windows 11"
    },
    "fullName": "Lenovo IdeaPad 3 15"
  },
  {
    "brand": "Lenovo",
    "name": "IdeaPad Slim 3",
    "defaultSpecs": {
      "cpu": "Intel Core i5-1235U",
      "ram": "8GB",
      "storage": "512GB SSD",
      "screenSize": "15.6\"",
      "gpu": "Intel Iris Xe",
      "resolution": "1920x1080 (FHD)",
      "os": "Windows 11"
    },
    "fullName": "Lenovo IdeaPad Slim 3"
  },
  {
    "brand": "Lenovo",
    "name": "Legion 5",
    "defaultSpecs": {
      "cpu": "AMD Ryzen 7 5800H",
      "ram": "16GB",
      "storage": "512GB SSD",
      "screenSize": "15.6\"",
      "gpu": "NVIDIA GeForce RTX 3060",
      "resolution": "1920x1080 (FHD)",
      "os": "Windows 11"
    },
    "fullName": "Lenovo Legion 5"
  },
  {
    "brand": "Asus",
    "name": "VivoBook 15",
    "defaultSpecs": {
      "cpu": "Intel Core i5-1135G7",
      "ram": "8GB",
      "storage": "512GB SSD",
      "screenSize": "15.6\"",
      "gpu": "Intel Iris Xe",
      "resolution": "1920x1080 (FHD)",
      "os": "Windows 11"
    },
    "fullName": "Asus VivoBook 15"
  },
  {
    "brand": "Asus",
    "name": "VivoBook 16",
    "defaultSpecs": {
      "cpu": "Intel Core i5-1235U",
      "ram": "16GB",
      "storage": "512GB SSD",
      "screenSize": "16.0\"",
      "gpu": "Intel Iris Xe",
      "resolution": "1920x1200",
      "os": "Windows 11"
    },
    "fullName": "Asus VivoBook 16"
  },
  {
    "brand": "Asus",
    "name": "TUF Gaming F15",
    "defaultSpecs": {
      "cpu": "Intel Core i5-11400H",
      "ram": "8GB",
      "storage": "512GB SSD",
      "screenSize": "15.6\"",
      "gpu": "NVIDIA GeForce RTX 3050",
      "resolution": "1920x1080 (FHD)",
      "os": "Windows 11"
    },
    "fullName": "Asus TUF Gaming F15"
  },
  {
    "brand": "Asus",
    "name": "ROG Strix G16",
    "defaultSpecs": {
      "cpu": "Intel Core i7-13650HX",
      "ram": "16GB",
      "storage": "1TB SSD",
      "screenSize": "16.0\"",
      "gpu": "NVIDIA GeForce RTX 4060",
      "resolution": "1920x1200",
      "os": "Windows 11"
    },
    "fullName": "Asus ROG Strix G16"
  },
  {
    "brand": "Asus",
    "name": "ZenBook 14",
    "defaultSpecs": {
      "cpu": "Intel Core i7-1260P",
      "ram": "16GB",
      "storage": "512GB SSD",
      "screenSize": "14.0\"",
      "gpu": "Intel Iris Xe",
      "resolution": "2880x1800 (2.8K OLED)",
      "os": "Windows 11"
    },
    "fullName": "Asus ZenBook 14"
  },
  {
    "brand": "Apple",
    "name": "MacBook Air M1 (2020)",
    "defaultSpecs": {
      "cpu": "Apple M1",
      "ram": "8GB",
      "storage": "256GB SSD",
      "screenSize": "13.3\"",
      "gpu": "Apple M1 GPU",
      "resolution": "2560x1600 Retina",
      "os": "macOS"
    },
    "fullName": "Apple MacBook Air M1 (2020)"
  },
  {
    "brand": "Apple",
    "name": "MacBook Air M2 (2022)",
    "defaultSpecs": {
      "cpu": "Apple M2",
      "ram": "8GB",
      "storage": "256GB SSD",
      "screenSize": "13.6\"",
      "gpu": "Apple M2 GPU",
      "resolution": "2560x1664 Liquid Retina",
      "os": "macOS"
    },
    "fullName": "Apple MacBook Air M2 (2022)"
  },
  {
    "brand": "Apple",
    "name": "MacBook Pro 14 M1 Pro",
    "defaultSpecs": {
      "cpu": "Apple M1 Pro",
      "ram": "16GB",
      "storage": "512GB SSD",
      "screenSize": "14.2\"",
      "gpu": "Apple M1 Pro GPU",
      "resolution": "3024x1964 Liquid Retina XDR",
      "os": "macOS"
    },
    "fullName": "Apple MacBook Pro 14 M1 Pro"
  },
  {
    "brand": "Apple",
    "name": "MacBook Pro 14 M2 Pro",
    "defaultSpecs": {
      "cpu": "Apple M2 Pro",
      "ram": "16GB",
      "storage": "512GB SSD",
      "screenSize": "14.2\"",
      "gpu": "Apple M2 Pro GPU",
      "resolution": "3024x1964 Liquid Retina XDR",
      "os": "macOS"
    },
    "fullName": "Apple MacBook Pro 14 M2 Pro"
  },
  {
    "brand": "Apple",
    "name": "MacBook Pro 14 M3 Pro",
    "defaultSpecs": {
      "cpu": "Apple M3 Pro",
      "ram": "18GB",
      "storage": "512GB SSD",
      "screenSize": "14.2\"",
      "gpu": "Apple M3 Pro GPU",
      "resolution": "3024x1964 Liquid Retina XDR",
      "os": "macOS"
    },
    "fullName": "Apple MacBook Pro 14 M3 Pro"
  }
];

export const DEFAULT_PROCESSORS: Array<{ name: string; generation?: string }> = [
  {
    "name": "10th Gen Core i5"
  },
  {
    "name": "11th Gen Core i3"
  },
  {
    "name": "11th Gen Core i5"
  },
  {
    "name": "11th Gen Core i7"
  },
  {
    "name": "12th Gen Core i3"
  },
  {
    "name": "12th Gen Core i5"
  },
  {
    "name": "12th Gen Core i7"
  },
  {
    "name": "13th Gen Core i3"
  },
  {
    "name": "13th Gen Core i5"
  },
  {
    "name": "13th Gen Core i7"
  },
  {
    "name": "13th Gen Core i9"
  },
  {
    "name": "14th Gen Core i7"
  },
  {
    "name": "8LX79PA) Laptop (8th Gen Core i5"
  },
  {
    "name": "AMD Athlon Silver 7120U"
  },
  {
    "name": "AMD Athlon Silver-3050U"
  },
  {
    "name": "AMD Ryzen 3 3250U"
  },
  {
    "name": "AMD Ryzen 3 5300U"
  },
  {
    "name": "AMD Ryzen 3 7320U"
  },
  {
    "name": "AMD Ryzen 3 7330U"
  },
  {
    "name": "AMD Ryzen 5 3500U"
  },
  {
    "name": "AMD Ryzen 5 5500U"
  },
  {
    "name": "AMD Ryzen 5 5600H"
  },
  {
    "name": "AMD Ryzen 5 5625U"
  },
  {
    "name": "AMD Ryzen 5 6600H"
  },
  {
    "name": "AMD Ryzen 5 7520U"
  },
  {
    "name": "AMD Ryzen 5 7530U"
  },
  {
    "name": "AMD Ryzen 5 7535HS"
  },
  {
    "name": "AMD Ryzen 7 5700U"
  },
  {
    "name": "AMD Ryzen 7 5800H"
  },
  {
    "name": "AMD Ryzen 7 5800U"
  },
  {
    "name": "AMD Ryzen 7 6800H"
  },
  {
    "name": "AMD Ryzen 7 7730U"
  },
  {
    "name": "AMD Ryzen 7 7735HS"
  },
  {
    "name": "AMD Ryzen 7 7840HS"
  },
  {
    "name": "AMD Ryzen 9 6900HS"
  },
  {
    "name": "AMD Ryzen 9 7940HS"
  },
  {
    "name": "AQC"
  },
  {
    "name": "Apple M1"
  },
  {
    "name": "Apple M1 Max"
  },
  {
    "name": "Apple M1 Pro"
  },
  {
    "name": "Apple M2"
  },
  {
    "name": "Apple M2 Max"
  },
  {
    "name": "Apple M2 Pro"
  },
  {
    "name": "Apple M3"
  },
  {
    "name": "Apple M3 Max"
  },
  {
    "name": "Apple M3 Pro"
  },
  {
    "name": "Celeron N4020"
  },
  {
    "name": "Intel Celeron N4020"
  },
  {
    "name": "Intel Celeron N4500"
  },
  {
    "name": "Intel Celeron N5100"
  },
  {
    "name": "Intel Core Ultra 7"
  },
  {
    "name": "Intel Core i3 N305"
  },
  {
    "name": "Intel Core i3-1115G4"
  },
  {
    "name": "Intel Core i3-1215U"
  },
  {
    "name": "Intel Core i3-1315U"
  },
  {
    "name": "Intel Core i5-10210U"
  },
  {
    "name": "Intel Core i5-1135G7"
  },
  {
    "name": "Intel Core i5-11400H"
  },
  {
    "name": "Intel Core i5-1235U"
  },
  {
    "name": "Intel Core i5-12450H"
  },
  {
    "name": "Intel Core i5-12500H"
  },
  {
    "name": "Intel Core i5-1335U"
  },
  {
    "name": "Intel Core i5-13420H"
  },
  {
    "name": "Intel Core i5-13500H"
  },
  {
    "name": "Intel Core i5-8250U"
  },
  {
    "name": "Intel Core i7-10750H"
  },
  {
    "name": "Intel Core i7-1165G7"
  },
  {
    "name": "Intel Core i7-11800H"
  },
  {
    "name": "Intel Core i7-1255U"
  },
  {
    "name": "Intel Core i7-12700H"
  },
  {
    "name": "Intel Core i7-1355U"
  },
  {
    "name": "Intel Core i7-13700H"
  },
  {
    "name": "Intel Core i7-8550U"
  },
  {
    "name": "Intel Core i9-13900H"
  },
  {
    "name": "Intel Core i9-13980HX"
  },
  {
    "name": "Intel Pentium Silver N6000"
  },
  {
    "name": "MediaTek Kompanio 500"
  },
  {
    "name": "Ryzen 5-5600H"
  },
  {
    "name": "Ryzen 7-5800H"
  }
];

export const DEFAULT_RAM_OPTIONS: Array<{ capacity: string; type?: string }> = [
  {
    "capacity": "4GB"
  },
  {
    "capacity": "6GB"
  },
  {
    "capacity": "8GB"
  },
  {
    "capacity": "12GB"
  },
  {
    "capacity": "16GB"
  },
  {
    "capacity": "18GB"
  },
  {
    "capacity": "24GB"
  },
  {
    "capacity": "32GB"
  },
  {
    "capacity": "36GB"
  },
  {
    "capacity": "48GB"
  },
  {
    "capacity": "64GB"
  },
  {
    "capacity": "2GB"
  }
];

export const DEFAULT_STORAGE_OPTIONS: Array<{ capacity: string; type?: string }> = [
  {
    "capacity": "64GB SSD"
  },
  {
    "capacity": "128GB SSD"
  },
  {
    "capacity": "256GB SSD"
  },
  {
    "capacity": "512GB SSD"
  },
  {
    "capacity": "1TB SSD"
  },
  {
    "capacity": "2TB SSD"
  },
  {
    "capacity": "500GB HDD"
  },
  {
    "capacity": "1TB HDD"
  },
  {
    "capacity": "2TB HDD"
  },
  {
    "capacity": "64GB EMMC"
  }
];

export const DEFAULT_SCREEN_SIZES: Array<{ size: string; resolution?: string; panelType?: string }> = [
  {
    "size": "10.1\""
  },
  {
    "size": "11.6\""
  },
  {
    "size": "12.4\""
  },
  {
    "size": "13.0\""
  },
  {
    "size": "13.3\""
  },
  {
    "size": "13.4\""
  },
  {
    "size": "13.5\""
  },
  {
    "size": "13.6\""
  },
  {
    "size": "14.0\""
  },
  {
    "size": "14.1\""
  },
  {
    "size": "14.2\""
  },
  {
    "size": "14.5\""
  },
  {
    "size": "15.0\""
  },
  {
    "size": "15.3\""
  },
  {
    "size": "15.6\""
  },
  {
    "size": "16.0\""
  },
  {
    "size": "16.1\""
  },
  {
    "size": "16.2\""
  },
  {
    "size": "17.3\""
  },
  {
    "size": "18.0\""
  }
];
