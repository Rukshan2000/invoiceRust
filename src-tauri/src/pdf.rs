use printpdf::{PdfDocument, Mm, BuiltinFont, Color, Rgb, Line, Point, Image, ImageTransform};
use std::fs::File;
use std::io::BufWriter;
use image as image_crate;

use crate::models::{Invoice, Settings};

pub fn generate_invoice_pdf(
    invoice: &Invoice,
    settings: &Settings,
    file_path: &str,
) -> Result<String, String> {
    let (doc, page1, layer1) = PdfDocument::new(
        &format!("Invoice {}", invoice.invoice_number.as_deref().unwrap_or("")),
        Mm(210.0),
        Mm(297.0),
        "Layer 1",
    );

    let layer = doc.get_page(page1).get_layer(layer1);
    let font = doc.add_builtin_font(BuiltinFont::Helvetica).map_err(|e| e.to_string())?;
    let font_bold = doc.add_builtin_font(BuiltinFont::HelveticaBold).map_err(|e| e.to_string())?;

    let currency = &settings.currency_symbol;
    let mut y: f32 = 270.0;

    // ── Header: Logo & Business Name ──
    let mut header_x: f32 = 20.0;
    if let Some(ref logo_path) = settings.logo_path {
        if let Ok(img) = image_crate::open(logo_path) {
            let width = img.width() as f32;
            let height = img.height() as f32;
            
            let pdf_img = Image::from_dynamic_image(&img);
            
            // Limit logo height to ~15mm
            let target_height = 15.0;
            let scale = target_height / height.max(1.0);
            
            pdf_img.add_to_layer(layer.clone(), ImageTransform {
                translate_x: Some(Mm(20.0)),
                translate_y: Some(Mm(y - 12.0)),
                rotate: None,
                scale_x: Some(scale),
                scale_y: Some(scale),
                dpi: None,
            });
            
            header_x = 20.0 + (width * scale) + 10.0;
            if header_x < 55.0 { header_x = 55.0; }
        }
    }

    // Template specific color accent
    let accent_color = match settings.template_type.as_str() {
        "Professional" => Color::Rgb(Rgb::new(0.0, 0.2, 0.4, None)), // Dark Blue
        "Modern" => Color::Rgb(Rgb::new(0.6, 0.1, 0.3, None)), // Maroon/Modern Pink
        _ => Color::Rgb(Rgb::new(0.0, 0.0, 0.0, None)), // Black
    };

    layer.set_fill_color(accent_color.clone());
    layer.use_text(&settings.business_name, 20.0, Mm(header_x), Mm(y), &font_bold);
    layer.set_fill_color(Color::Rgb(Rgb::new(0.0, 0.0, 0.0, None))); // Reset to black

    y -= 7.0;
    if let Some(ref addr) = settings.business_address {
        layer.use_text(addr, 9.0, Mm(header_x), Mm(y), &font);
        y -= 5.0;
    }
    if let Some(ref phone) = settings.business_phone {
        layer.use_text(&format!("Phone: {}", phone), 9.0, Mm(header_x), Mm(y), &font);
        y -= 5.0;
    }
    if let Some(ref email) = settings.business_email {
        layer.use_text(&format!("Email: {}", email), 9.0, Mm(header_x), Mm(y), &font);
        y -= 5.0;
    }

    // ── Invoice Title ──
    y -= 5.0;
    layer.set_fill_color(accent_color.clone());
    layer.use_text("INVOICE", 24.0, Mm(140.0), Mm(270.0), &font_bold);
    layer.set_fill_color(Color::Rgb(Rgb::new(0.0, 0.0, 0.0, None)));

    layer.use_text(
        &format!("# {}", invoice.invoice_number.as_deref().unwrap_or("-")),
        11.0,
        Mm(140.0),
        Mm(263.0),
        &font,
    );

    // ── Dates ──
    y -= 3.0;
    let dates_y = y;
    layer.use_text(&format!("Issue Date: {}", &invoice.issue_date), 10.0, Mm(140.0), Mm(dates_y), &font);
    layer.use_text(&format!("Due Date:   {}", &invoice.due_date), 10.0, Mm(140.0), Mm(dates_y - 5.0), &font);
    layer.use_text(&format!("Status:     {}", &invoice.status), 10.0, Mm(140.0), Mm(dates_y - 10.0), &font);

    // ── Bill To ──
    y -= 5.0;
    layer.set_fill_color(accent_color.clone());
    layer.use_text("Bill To:", 11.0, Mm(20.0), Mm(y), &font_bold);
    layer.set_fill_color(Color::Rgb(Rgb::new(0.0, 0.0, 0.0, None)));
    y -= 6.0;
    layer.use_text(
        invoice.customer_name.as_deref().unwrap_or("—"),
        10.0,
        Mm(20.0),
        Mm(y),
        &font,
    );
    y -= 15.0;

    // ── Table header ──
    let header_y = y;
    layer.set_fill_color(accent_color.clone());
    layer.use_text("Item", 10.0, Mm(20.0), Mm(header_y), &font_bold);
    layer.use_text("Qty", 10.0, Mm(100.0), Mm(header_y), &font_bold);
    layer.use_text("Unit Price", 10.0, Mm(115.0), Mm(header_y), &font_bold);
    layer.use_text("Tax %", 10.0, Mm(145.0), Mm(header_y), &font_bold);
    layer.use_text("Total", 10.0, Mm(170.0), Mm(header_y), &font_bold);
    layer.set_fill_color(Color::Rgb(Rgb::new(0.0, 0.0, 0.0, None)));

    // Draw a line under header
    y -= 2.0;
    layer.set_outline_color(accent_color.clone());
    let line = Line {
        points: vec![
            (Point::new(Mm(20.0), Mm(y)), false),
            (Point::new(Mm(190.0), Mm(y)), false),
        ],
        is_closed: false,
    };
    layer.add_line(line);
    layer.set_outline_color(Color::Rgb(Rgb::new(0.0, 0.0, 0.0, None)));
    y -= 5.0;

    // ── Items ──
    if let Some(ref items) = invoice.items {
        for item in items {
            layer.use_text(&item.product_name, 9.0, Mm(20.0), Mm(y), &font);
            layer.use_text(&item.quantity.to_string(), 9.0, Mm(100.0), Mm(y), &font);
            layer.use_text(&format!("{}{:.2}", currency, item.unit_price), 9.0, Mm(115.0), Mm(y), &font);
            layer.use_text(&format!("{:.1}%", item.tax_percent), 9.0, Mm(145.0), Mm(y), &font);
            layer.use_text(&format!("{}{:.2}", currency, item.line_total), 9.0, Mm(170.0), Mm(y), &font);
            y -= 6.0;
        }
    }

    // ── Totals ──
    y -= 5.0;
    layer.set_outline_color(accent_color.clone());
    let line2 = Line {
        points: vec![
            (Point::new(Mm(120.0), Mm(y + 3.0)), false),
            (Point::new(Mm(190.0), Mm(y + 3.0)), false),
        ],
        is_closed: false,
    };
    layer.add_line(line2);
    layer.set_outline_color(Color::Rgb(Rgb::new(0.0, 0.0, 0.0, None)));

    layer.use_text("Subtotal:", 10.0, Mm(130.0), Mm(y), &font);
    layer.use_text(&format!("{}{:.2}", currency, invoice.subtotal), 10.0, Mm(170.0), Mm(y), &font);
    y -= 6.0;

    layer.use_text(&format!("{}:", &settings.tax_label), 10.0, Mm(130.0), Mm(y), &font);
    layer.use_text(&format!("{}{:.2}", currency, invoice.tax), 10.0, Mm(170.0), Mm(y), &font);
    y -= 6.0;

    if invoice.discount > 0.0 {
        layer.use_text("Discount:", 10.0, Mm(130.0), Mm(y), &font);
        layer.use_text(&format!("-{}{:.2}", currency, invoice.discount), 10.0, Mm(170.0), Mm(y), &font);
        y -= 6.0;
    }

    layer.set_fill_color(accent_color.clone());
    layer.use_text("TOTAL:", 12.0, Mm(130.0), Mm(y), &font_bold);
    layer.use_text(&format!("{}{:.2}", currency, invoice.total), 12.0, Mm(170.0), Mm(y), &font_bold);
    layer.set_fill_color(Color::Rgb(Rgb::new(0.0, 0.0, 0.0, None)));
    y -= 12.0;

    // ── Notes ──
    if let Some(ref notes) = invoice.notes {
        if !notes.is_empty() {
            layer.set_fill_color(accent_color.clone());
            layer.use_text("Notes:", 10.0, Mm(20.0), Mm(y), &font_bold);
            layer.set_fill_color(Color::Rgb(Rgb::new(0.0, 0.0, 0.0, None)));
            y -= 5.0;
            layer.use_text(notes, 9.0, Mm(20.0), Mm(y), &font);
        }
    }

    // ── Footer ──
    let footer_text = settings.default_footer.as_deref().unwrap_or("Thank you for your business!");
    layer.use_text(
        footer_text,
        10.0,
        Mm(65.0),
        Mm(15.0),
        &font,
    );

    // Save
    let file = File::create(file_path).map_err(|e| e.to_string())?;
    doc.save(&mut BufWriter::new(file)).map_err(|e| e.to_string())?;

    Ok(file_path.to_string())
}
